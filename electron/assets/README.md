# App Icons

Place your app icons here before building:

| File        | Platform | Size             |
|-------------|----------|------------------|
| `icon.ico`  | Windows  | multi-res ICO    |
| `icon.icns` | macOS    | multi-res ICNS   |
| `icon.png`  | Linux    | 512×512 PNG      |

## Quickest way: electron-icon-builder

1. Create a 1024×1024 PNG source image.
2. Run:
   ```
   npx electron-icon-builder --input=icon-source.png --output=.
   ```
   It generates all three formats automatically.

## Without icons

The build still works — the app just uses Electron's default icon.
The tray icon will be blank; no crash.
