const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#2b2f3a"/>
<stop offset="1" stop-color="#12141a"/>
</linearGradient>
</defs>
<rect width="512" height="512" rx="28" fill="url(#bg)"/>
<circle cx="256" cy="256" r="150" fill="#ffffff" fill-opacity="0.05"/>
<g fill="#d7dbe4">
<path d="M340 108c0-9-8-15-17-13l-132 30c-9 2-15 9-15 18v152a46 46 0 1 0 28 42V201l105-24v101a46 46 0 1 0 28 42V108z"/>
</g>
</svg>`;

export const DEFAULT_AUDIO_ARTWORK = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
	SVG
)}`;

export const DEFAULT_AUDIO_ARTWORK_SIZE = 512;