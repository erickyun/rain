import update from "@api/native/modules/update";
import { showToast } from "@api/ui/toasts";
import { Stack, TableRow, TableRowGroup, TableSwitchRow } from "@metro/common/components";
import React from "react";
import { ScrollView } from "react-native";

import { usePrivacyControlsSettings } from "./storage";

export default function PrivacyControlsSettings() {
    const settings = usePrivacyControlsSettings();
    return (
        <ScrollView style={{ flex: 1 }}>
            <Stack style={{ paddingVertical: 24, paddingHorizontal: 12 }} spacing={24}>
                <TableRowGroup title="Avatars">
                    <TableSwitchRow
                        label="Hide Message Avatars"
                        subLabel="Hide user pictures beside messages and reply previews."
                        value={settings.hideMessageAvatars}
                        onValueChange={hideMessageAvatars => settings.updateSettings({ hideMessageAvatars })}
                    />
                    <TableSwitchRow
                        label="Hide All Avatars"
                        subLabel="Hide avatars across chat, profiles, DMs and user lists; also covers message avatars."
                        value={settings.hideAllAvatars}
                        onValueChange={hideAllAvatars => settings.updateSettings({ hideAllAvatars })}
                    />
                </TableRowGroup>
                <TableRowGroup title="Names">
                    <TableSwitchRow
                        label="Hide Username"
                        subLabel="Hide @handles while keeping display names when possible."
                        value={settings.hideUsername}
                        onValueChange={hideUsername => settings.updateSettings({ hideUsername })}
                    />
                    <TableSwitchRow
                        label="Hide Display Name"
                        subLabel="Hide display names and nicknames; independent of usernames."
                        value={settings.hideDisplayName}
                        onValueChange={hideDisplayName => settings.updateSettings({ hideDisplayName })}
                    />
                </TableRowGroup>
                <TableRowGroup title="Apply">
                    <TableRow
                        label="Reload Rain"
                        subLabel="Refresh existing chat rows and cached profile headers after changing settings."
                        onPress={async () => {
                            try {
                                await update.nativeReload();
                            } catch {
                                showToast("Unable to reload Rain");
                            }
                        }}
                    />
                </TableRowGroup>
            </Stack>
        </ScrollView>
    );
}
