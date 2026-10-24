# chrome.dxlcoop
Improves Drexel co-op job viewing by displaying job details inline in job cart and search results. Adds text filtering and download functionality.


Copyright (c) 2026 Ahmet Sacan.

This project is not currently licensed for redistribution or commercial use.

---

# Features
* Filter the list of jobs using a query. Query may contain multiple words. You may separate the words with "OR" or "AND" (use only one of these). When not provided, the words are combined with "AND" logic, searching for jobs that contain all of the words.

---
# Disclaimer

This extension is provided "as is" and without warranties of any kind, express or implied. The author makes no guarantee that the extension will function correctly, reliably, or continuously, or that the information it displays, processes, filters, or downloads will be complete or accurate.

Use of this extension is entirely at your own risk. The author assumes no responsibility or liability for any errors, omissions, data loss, unintended actions, missed job opportunities, or other damages or consequences arising from the use or inability to use this extension.

This extension is an independent project and is not affiliated with, endorsed by, or supported by Drexel University, Ellucian, or their affiliates. Users are responsible for verifying important information directly through the official Drexel systems before taking action.
# Privacy Policy
The extension uses the storage permission to cache job details, to avoid repeatedly fetching the same job details. No personal data is collected, transmitted, or shared. All stored data remains on the user's device using the Chrome Extensions Storage API.

The stored data is used only to remember the user's preferences and state between browsing sessions. It is not used for analytics, advertising, tracking, or profiling.

The extension loads only the job detail URLs that appear on the user's cart or search page. It does not modify the destination URLs or append query parameters or other identifying information. The loaded URLs are used solely to display the requested content and are not used to collect, transmit, or infer additional user data. The extension does not use host permissions for tracking, analytics, advertising, or access to unrelated websites.

---

# Installation (Chrome Web Store)

* Link to Chrome Web Store Extension will appear here. (Not available yet.)

# Advanced Installation (Developer Mode)

1. Clone or download this repository. If you download a zip file, unzip it.
2. Open Chrome and navigate to:

```text
chrome://extensions
```

3. Enable **Developer mode** (using the checkbox at the top right corner).
4. Select **Load unpacked**.
5. Choose the extension folder.

---

# Customization

The extension does not provide an options page. The current selections for job details are saved when the user changes them while using the extension.

---
