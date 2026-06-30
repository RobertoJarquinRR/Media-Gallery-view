# Media Gallery

**Media Gallery lets you create a gallery of your video files directly inside of your notes in obsidian**

> **Note:** This plugin currently supports video galleries only.

## Roadmap
- [x] video support
- [ ] Image support
- [ ] Audio support
- [ ] Pdf support

## Examples
![VideoGallery](assets/Example1.png)


## Installation

### Via BRAT (Beta)
1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) in Obsidian.
2. Open BRAT settings and click "Add Beta Plugin".
3. Enter this repository URL: `https://github.com/RobertoJarquinRR/Media-Gallery-view`
4. Enable the plugin in Obsidian's Community Plugins settings.

### Via Obsidian Community Plugins
Search for "Media Gallery" in Obsidian's Community Plugins browser and install it directly.

## Usage

Create a code block with the language set to `MediaGallery` in any note:

````md
```media-gallery
path: directory/videos
```
````

The plugin will render all videos found in the specified folder as a justified gallery, respecting each video's original aspect ratio.
