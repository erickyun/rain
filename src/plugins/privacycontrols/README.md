# PrivacyControls (Rain iOS/Android)

Local-only presentation controls, added to the Rain plugin settings as four independent switches:

- **Hide Message Avatars**: replace user faces in chat rows and reply previews with a fully transparent 1x1 PNG.
- **Hide All Avatars**: includes chat; additionally targets shared avatar components, avatar utility resolvers and profile header avatars.
- **Hide Username**: suppress @handles via user-tag resolvers, matching chat header handles and user-row secondary labels.
- **Hide Display Name**: suppress chat author labels and resolved user display names/nicknames.

All four preferences default to **off**. No API mutations, no account changes, no downloaded photo filtering and no server icon/attachment rewriting.

## Installation / testing

The plugin directory is auto-discovered by `scripts/build/plugins/plugins-importer.mjs`. Build the Rain bundle from your fork (`npm install && npm run build`) and configure RainTweak to load that bundle using its existing custom loader URL support. **No changes to RainTweak's native code are needed** for these source changes.

Enable `PrivacyControls` under Rain Plugins, open its settings, enable one switch at a time, then use **Reload Rain** to refresh cached native chat rows. Test chat (including replies), DMs, profiles, member list, reaction lists and mentions.

## Limitations

This is an initial source-level implementation, **not yet verified on an actual Discord iOS build**. Discord UI modules may differ by version and some views may bypass the specific name/avatar resolvers. Because the native chat list owns already-generated rows, recently visible rows may not update until reload. The transparent data URI's behavior in the native chat image component requires device verification. Hiding display names or handles is local UI privacy, not anonymity: message content, reactions and user IDs remain intact.
