# Media Gallery

**Browse your vault's videos, images, PDFs and audio in a dedicated gallery view, or embed galleries directly in your notes.**

Media Gallery adds a gallery browser to Obsidian: organize your media into named libraries, switch between them with tabs, and choose the layout that fits each collection.

## New in 0.9.0

- **Per-library layout**: every library can use Masonry, Grid or Grid (fixed ratio) independently, or inherit the global default.
- **Layout selector in Settings → Libraries**: pick a layout per library without changing the rest.
- **Improved library settings**: library rows wrap cleanly and the folder path gets its own full-width row.

## Features

### Galleries and libraries

- Multiple named libraries, each with its own media type and vault folder.
- Tabs to switch between libraries inside the gallery view.
- Image, video, PDF and audio galleries.
- Per-library layout override (new in 0.9.0).

### Layouts

- Masonry, fixed-height grid and fixed-ratio grid.
- Global default layout plus per-library overrides.
- Masonry columns: automatic or a fixed 2–6 columns.
- Configurable masonry minimum column width and gap.
- Configurable card height for the grid modes.

### Viewing

- Full-screen overlay for every media type.
- Image lightbox with zoom, pan, mouse wheel, pinch and drag.
- Built-in PDF reader with scrolling, page navigation and zoom.
- Video overlay with hover controls.
- Audio player with thumbnail strip navigation.
- Arrow navigation, `Esc` to close, and double-click to open a file externally.
- Choose whether files open in an Obsidian tab or with the system default app.

### Thumbnails

- Automatic thumbnails for images, PDFs and audio.
- Cached in the plugin folder and loaded on demand.
- Fast low-resolution previews before the final thumbnail.
- Custom thumbnail folder: files are matched by name, so `clip.pdf` uses `clip.png`.
- Audio artwork read from file tags or from a cover image in the same folder.

### Configuration

- Sort by name, modified date or size, ascending or descending.
- Configurable file extensions per media type.
- Show or hide file names.
- Toggle overlay arrows.
- Video controls, muted, autoplay and loop.
- Audio autoplay.
- English and Spanish interface.

## Layout modes

| Mode | Behavior |
| --- | --- |
| **Masonry** (default) | Pinterest-style balanced columns. Cards keep their natural aspect ratio and are placed in the shortest column. Best for mixed portrait, landscape and square media. |
| **Grid** | Uniform rows with a fixed card height. Media is contained inside each cell. |
| **Grid (fixed ratio)** | Uniform 4:3 cards that fill the available width. Media covers the cell for a poster-like grid. |

Set the global layout in **Settings → Appearance → Layout mode**. Each library can override it in **Settings → Libraries**.

## Installation

### Via BRAT (Beta)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) in Obsidian.
2. Open BRAT settings and click "Add Beta Plugin".
3. Enter this repository URL: `https://github.com/RobertoJarquinRR/Media-Gallery-view`
4. Enable the plugin in Obsidian's Community Plugins settings.

### Via Obsidian Community Plugins

Search for "Media Gallery" in Obsidian's Community Plugins browser and install it directly.

## Getting started

1. Open **Settings → Media Gallery view**.
2. Under **General**, enable **Enable gallery view**. This adds a ribbon icon; you can also open the view from the command palette.
3. Under **Libraries**, add or edit a library: name, media type, folder path and layout.
4. Open the gallery from the ribbon icon or the **Open media gallery** command.
5. Use the tabs at the top to switch between libraries.

If a library has no folder configured, it shows a message pointing back to Settings.

## Settings reference

| Section | Options |
| --- | --- |
| **General** | Language, enable gallery view |
| **Libraries** | Name, media type, folder path, layout (global default or per library) |
| **Gallery defaults** | Default type for code blocks, sort order, extensions per media type, open files with |
| **Appearance** | Card height, layout mode, masonry columns, minimum column width, gap, show file names, overlay arrows, custom thumbnail folder |
| **Video** | Controls, muted, autoplay, loop |
| **Audio** | Autoplay |

## Viewing files

- **Video**: hover a card to reveal playback controls. Clicking a card opens the overlay without starting playback; use the controls to play.
- **Image**: click a card to open the fullscreen lightbox. Zoom with the toolbar, mouse wheel or pinch, and drag to pan while zoomed.
- **PDF**: click a card to open the built-in reader; pages render as you scroll. Double-click a card or a page to open the PDF in a new Obsidian tab or with the system app.
- **Audio**: click a card to open the built-in player; move between tracks with the overlay arrows or the thumbnail strip.
- **All galleries**: `Esc` closes the overlay, and double-clicking a card opens the file using the **Open files with** setting.

## Code block galleries

Code block galleries are still supported for embedding media inside a note. Create a `MediaGallery` block with a `path:` and an optional `type:` (`image`, `video`, `pdf` or `audio`). If `type:` is omitted, the plugin uses the default type from settings.

````md
```MediaGallery
path: directory/videos
type: video
```
````

Code block galleries use the global layout mode from **Settings → Appearance**. Per-library layouts only apply to the gallery view.

### Code block examples

These demos show galleries embedded with code blocks. The same media types are available in the Gallery View.

**Video**

![Video gallery code block](assets/video-gallery-demo.gif)

**Images**

![Image gallery code block](assets/images-gallery-demo.gif)

## Requirements

- Obsidian 1.13.0 or newer.
- Thumbnails are generated and PDFs are rendered locally; no external service is used.

## Recommendation

For a better video playback experience, consider installing the **Media Extended** plugin. This only improves playback when you open a video in a separate note; the gallery itself renders videos with the default HTML5 player for performance reasons.

## Roadmap

- [x] Video, image, PDF and audio galleries
- [x] Gallery view with multiple libraries
- [x] Masonry, fixed-height grid and fixed-ratio grid
- [x] Per-library layout modes
- [x] Image and PDF zoom
- [ ] Virtualized rendering for very large libraries

## Credits

PDF rendering is powered by [PDF.js](https://github.com/mozilla/pdf.js) (Apache-2.0).
Audio metadata extraction is powered by [music-metadata](https://github.com/Borewit/music-metadata) (MIT).

## License

0-BSD. See [LICENSE](LICENSE).
