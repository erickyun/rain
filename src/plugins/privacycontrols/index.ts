import { after } from "@api/patcher";
import { waitForHydration } from "@api/storage";
import { findByFilePath, findByName, findByProps, findByStoreName } from "@metro";
import { UserStore } from "@metro/common/stores";
import { definePlugin } from "@plugins";
import React from "react";

import Settings from "./settings";
import { usePrivacyControlsSettings } from "./storage";

// A real RGBA 1x1 fully transparent PNG, not an invalid image URI or a remote tracking pixel.
// Chat rows are rendered natively, so returning null for avatarURL may trigger a fallback face.
const BLANK_AVATAR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==";
const BLANK_TEXT = "\u00a0";

type Cleanup = () => unknown;
const unpatches: Cleanup[] = [];

const settings = () => usePrivacyControlsSettings.getState();
const hideAvatarsInChat = () => settings().hideMessageAvatars || settings().hideAllAvatars;

function hook(target: any, method: string, callback: (args: any[], ret: any) => any) {
    if (typeof target?.[method] !== "function") return false;
    try {
        unpatches.push(after(method, target, callback));
        return true;
    } catch (error) {
        console.warn("[PrivacyControls] Could not patch", method, error);
        return false;
    }
}

function blankSource(source: any): any {
    if (typeof source === "string") return BLANK_AVATAR;
    if (typeof source === "number") return { uri: BLANK_AVATAR };
    if (source && typeof source === "object" && typeof source.uri === "string") {
        return { ...source, uri: BLANK_AVATAR };
    }
    return source;
}

function authorHandle(authorId: unknown): string | undefined {
    if (typeof authorId !== "string") return;
    try {
        return UserStore?.getUser?.(authorId)?.username;
    } catch {
        return;
    }
}

// Only mutate a private copy of the generated, flat native chat message.
// "username" is the displayed chat author label in Discord's row schema, and
// "avatarURL" is specifically the user's face, not an uploaded message image.
function privacyMessage(message: any, depth = 0): any {
    if (!message || typeof message !== "object" || depth > 2) return message;
    const state = settings();
    const out = { ...message };
    let changed = false;

    if (hideAvatarsInChat()) {
        if (typeof out.avatarURL === "string") {
            out.avatarURL = BLANK_AVATAR;
            changed = true;
        }
        // Remove avatar cosmetics but don't remove role icons, attachments or server icons.
        for (const key of ["avatarDecorationURL", "avatarDecorationUrl", "guildMemberAvatarDecoration"]) {
            if (out[key] != null) {
                out[key] = null;
                changed = true;
            }
        }
    }

    if (typeof out.username === "string") {
        if (state.hideDisplayName) {
            out.username = BLANK_TEXT;
            changed = true;
        } else if (state.hideUsername) {
            const handle = authorHandle(out.authorId);
            if (handle && (out.username === handle || out.username === `@${handle}`)) {
                out.username = BLANK_TEXT;
                changed = true;
            }
        }
    }

    const ref = out.referencedMessage;
    if (ref?.message && depth < 2) {
        const next = privacyMessage(ref.message, depth + 1);
        if (next !== ref.message) {
            out.referencedMessage = { ...ref, message: next };
            changed = true;
        }
    }
    return changed ? out : message;
}

function installChatHooks() {
    const RowManager = findByName("RowManager");
    if (!RowManager?.prototype) {
        console.warn("[PrivacyControls] RowManager was not available; message rows cannot be patched");
        return;
    }
    hook(RowManager.prototype, "generate", (_args, row) => {
        if (!row?.message) return row;
        const next = privacyMessage(row.message);
        return next === row.message ? row : { ...row, message: next };
    });
}

function installAvatarHooks() {
    // Covers avatar sources produced by Discord for user records in headers,
    // member lists, profiles, reaction sheets and DMs.
    const utils = findByProps("getUserAvatarURL", "getUserAvatarSource");
    for (const key of [
        "getUserAvatarURL",
        "getUserAvatarURLWithoutFallback",
        "getGuildMemberAvatarURL",
        "getGuildMemberAvatarURLSimple",
        "getUserAvatarSource",
        "getGuildMemberAvatarSource",
    ]) {
        hook(utils, key, (_args, source) => settings().hideAllAvatars ? blankSource(source) : source);
    }
    // Some Discord views render the shared Avatar component with a source
    // already resolved and bypass the URL utilities. Remove only that component.
    const module = findByProps("default", "AvatarSizes", "getStatusSize");
    const component = module?.default;
    if (typeof component?.type === "function") {
        hook(component, "type", (_args, result) => settings().hideAllAvatars ? null : result);
    } else if (typeof component === "function") {
        hook(module, "default", (_args, result) => settings().hideAllAvatars ? null : result);
    }

    const header = findByFilePath("modules/profile_customization/native/HeaderAvatar.tsx");
    if (header && typeof header.default === "function") {
        hook(header, "default", (_args, result) => settings().hideAllAvatars ? null : result);
    }
}

function installNameHooks() {
    // Discord's UserUtils exports these together. Do not patch random unrelated
    // modules which happen to export a generic function called getName.
    const utils = findByProps("getName", "nameFromUser", "getUserTag");
    for (const key of ["getName", "useName", "nameFromUser", "getGlobalName", "getFormattedName"]) {
        hook(utils, key, (args, result) =>
            settings().hideDisplayName && typeof result === "string"
                ? BLANK_TEXT : result
        );
    }
    for (const key of ["getUserTag", "useUserTag"]) {
        hook(utils, key, (args, result) =>
            settings().hideUsername && typeof result === "string"
                ? BLANK_TEXT : result
        );
    }

    // Nicknames in DM headers may bypass UserUtils and come directly from
    // RelationshipStore. Do not affect any unrelated store methods.
    const RelationshipStore = findByStoreName("RelationshipStore");
    if (RelationshipStore?.getNickname) {
        hook(RelationshipStore, "getNickname", (args, result) =>
            settings().hideDisplayName &&
            typeof args[0] === "string" &&
            /^\d{17,20}$/.test(args[0]) &&
            (result == null || typeof result === "string")
                ? BLANK_TEXT : result
        );
    }

    // User rows may receive preformatted names as props and bypass resolvers.
    // Don't blindly alter other text (status, timestamps, roles) in subLabel.
    const rowModule = findByFilePath("modules/main_tabs_v2/native/shared_components/user_list/UserRow.tsx");
    const row = rowModule?.default;
    if (typeof row?.type === "function") {
        hook(row, "type", (args, tree) => {
            const user = args?.[0]?.user;
            if (!user || !React.isValidElement(tree)) return tree;
            const state = settings();
            const changes: Record<string, unknown> = {};
            if (state.hideDisplayName) changes.label = BLANK_TEXT;
            if (state.hideUsername && typeof (tree.props as any)?.subLabel === "string") {
                const sub = (tree.props as any).subLabel as string;
                if (sub === user.username || sub === `@${user.username}`) changes.subLabel = BLANK_TEXT;
            }
            return Object.keys(changes).length ? React.cloneElement(tree, changes as any) : tree;
        });
    }
}

export default definePlugin({
    name: "PrivacyControls",
    description: "Four independent switches to hide message avatars, all avatars, usernames and display names locally.",
    id: "privacycontrols",
    author: [{ name: "erickyun", id: 0n }],
    version: "1.0.0",
    requiresRestart: true,
    settings: Settings,
    async start() {
        await waitForHydration(usePrivacyControlsSettings);
        installChatHooks();
        installAvatarHooks();
        installNameHooks();
    },
    stop() {
        for (const unpatch of unpatches.splice(0).reverse()) {
            try { unpatch(); } catch (error) { console.warn("[PrivacyControls] cleanup failed", error); }
        }
    },
});
