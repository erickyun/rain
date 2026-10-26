import { after } from "@api/patcher";
import { findInReactTree } from "@lib/utils";
import { logger } from "@lib/utils/logger";
import { findByFilePathLazy } from "@metro";
import { getLazyContext } from "@metro/lazy";
import { useColorsPref } from "@plugins/_core/painter/themes/preferences";
import { _colorRef } from "@plugins/_core/painter/themes/updater";
import chroma from "chroma-js";
import { ImageBackground, StyleSheet } from "react-native";

const Messages = findByFilePathLazy("modules/messages/native/Messages.tsx", true);

function ThemeBackground({ children }: { children: React.ReactNode; }) {
    const customBackground = useColorsPref(state => state.customBackground);

    if (!_colorRef.current
        || customBackground === "hidden"
        || !_colorRef.current.background?.url
        || _colorRef.current.background?.blur && (typeof _colorRef.current.background?.blur !== "number")
    ) {
        return children;
    }

    return <ImageBackground
        style={{ flex: 1, height: "100%" }}
        source={{ uri: _colorRef.current.background?.url }}
        blurRadius={_colorRef.current.background?.blur}
    >
        {children}
    </ImageBackground>;
}

export default function patchChatBackground() {
    // Some Discord builds export Messages as a function component rather than
    // a forwardRef object with a .render method. Defer until the module loads
    // and check the real export BEFORE installing any render patch. Otherwise
    // Rain's lazy patcher throws during ChatView initialization.
    let disposed = false;
    let unpatch: (() => unknown) | undefined;
    let unsubscribe: (() => unknown) | undefined;

    const context = getLazyContext(Messages);
    if (!context) {
        logger.warn("[Painter] Messages lazy context missing; skipping chat background patch");
        return () => {};
    }

    const patchMessages = (target: any) => {
        if (disposed) return;
        if (typeof target?.render !== "function") {
            logger.warn("[Painter] Messages.render unavailable in this Discord version; leaving chat background unchanged");
            return;
        }

        try {
            unpatch = after("render", target, (_, ret) => {
                if (!_colorRef.current || !_colorRef.current.background?.url) return;

                const messagesComponent = findInReactTree(
                    ret,
                    x => x && "HACK_fixModalInteraction" in x.props && x?.props?.style
                );
                if (messagesComponent) {
                    const flattened = StyleSheet.flatten(messagesComponent.props.style);
                    const backgroundColor = chroma(
                        flattened.backgroundColor || "black"
                    ).alpha(
                        1 - (_colorRef.current.background?.opacity ?? 1)
                    ).hex();
                    messagesComponent.props.style = StyleSheet.flatten([
                        messagesComponent.props.style,
                        { backgroundColor }
                    ]);
                }

                return <ThemeBackground>{ret}</ThemeBackground>;
            });
        } catch (e) {
            logger.error("[Painter] Failed to patch chat background.", e);
        }
    };

    try {
        unsubscribe = context.getExports(patchMessages);
    } catch (e) {
        logger.error("[Painter] Failed to resolve Messages component.", e);
    }

    return () => {
        disposed = true;
        try { unsubscribe?.(); } catch {}
        try { unpatch?.(); } catch {}
    };
}
