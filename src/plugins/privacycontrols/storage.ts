import { createPluginStore } from "@api/storage";

export interface PrivacyControlsSettings {
    hideMessageAvatars: boolean;
    hideAllAvatars: boolean;
    hideUsername: boolean;
    hideDisplayName: boolean;
}

export const {
    useStore: usePrivacyControlsSettings,
    settings: privacyControlsSettings,
} = createPluginStore<PrivacyControlsSettings>("privacycontrols", {
    hideMessageAvatars: false,
    hideAllAvatars: false,
    hideUsername: false,
    hideDisplayName: false,
});
