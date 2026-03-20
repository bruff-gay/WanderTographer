WanderTographer

A Firefox extension that adds your current browser URL to your own wander.js file hosted on GitHub or Codeberg.
What it does

    Reads your current tab URL when you explicitly click a button
    Appends that URL to the pages or consoles array in your wander.js file
    Commits the change directly to your repository via API

Setup

    Install the extension from addons.mozilla.org or load temporarily via about:debugging

    Generate an API token:
        GitHub: Settings → Developer settings → Personal access tokens → Fine-grained tokens
        Repository permissions: Contents → Read and write
        1
        3
        Codeberg: Settings → Applications → Manage Access Tokens
        Select repository or write:repository scope
        2
        4

    Configure WanderTographer:
        Click the extension icon
        Select your platform (GitHub or Codeberg)
        Paste your API token
        Enter your repository details (owner, repo name, file path, branch)
        Click Save Configuration

    Use it:
        Browse to any page you want to save
        Click Add to Pages or Add to Consoles

Privacy

WanderTographer does not collect any data. The extension only accesses your current tab URL when you explicitly click a button, and sends it directly to GitHub or Codeberg using your own API token. No data is transmitted to any third-party servers controlled by the extension developer.
Files
File 	Purpose
manifest.json 	Extension configuration
popup.html 	User interface
popup.js 	Core logic for API communication and file modification
License

MIT
