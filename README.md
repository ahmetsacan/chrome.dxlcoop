# chrome.dxlcoop
Improves Drexel co-op job viewing by displaying job details inline in job cart, search results, and interview requests. Adds searching, filtering, sorting, travel-time calculations, and CSV/TSV download functionality.

Copyright (c) 2026 Ahmet Sacan.

This project is not currently licensed for redistribution or commercial use.

---

# Features

* Display detailed job information directly within the job cart, job search results, and interview requests without having to open each job individually.

* Select which job details to display, including company information, position description, qualifications, application instructions, location, compensation, and requirements. Selections are remembered between browsing sessions.

* Cache downloaded job details locally to improve performance and avoid repeatedly retrieving the same information. The job cache can be cleared at any time.

* Load all pages of multi-page job search results into a single job list using the **All pages** button.

* Search and filter jobs using one or more terms. Matching text is highlighted for easier review. Multiple search terms can be combined using `AND` or `OR` (case-insensitive). If no operator is specified, `AND` is assumed. For example, `python finance` is equivalent to `python AND finance`, while `python OR finance` matches jobs containing either term.

* Filter jobs by travel distance or time using `<`, `<=`, `>`, or `>=`. Distance is specified in miles and time in minutes. For example, `python distance<=20` finds jobs containing "python" that are within 20 miles, while `data time<45` finds jobs containing "data" with an estimated travel time under 45 minutes. Multiple constraints may be used, such as `python distance<=25 time<45`. If distance or time information is unavailable for a job, that constraint is ignored for that job.

* Configure multiple starting addresses and independently select driving and public-transit calculations for each address. For example, `drive:Home`, `drive:Work`, `transit:Home`, and `transit:Work` can be selected in any combination.

* Display estimated travel time and distance for each selected starting-address/travel-mode combination. The displayed values link directly to the corresponding route in Google Maps.

* Public-transit estimates are calculated for arrival at 9:00 AM on the next Monday. Previously cached route results are reused.

* Sort jobs by ascending or descending travel time or distance. When multiple starting addresses or travel modes are selected, sorting uses the shortest available time or distance.

* Search constraints such as `time<45` and `distance<20` likewise use the shortest available value among the selected starting-address/travel-mode combinations.

* Download detailed job information as TSV or CSV, with individual job attributes stored in separate columns for further analysis in Excel or other software. When a search/filter is active, only matching jobs are downloaded.

* TSV and CSV downloads include cached time and distance information for **all configured starting addresses**, for both driving and transit, regardless of which route checkboxes are currently selected. Separate columns such as `Time (drive:Home)`, `Time (transit:Home)`, `Distance (drive:Home)`, and `Distance (transit:Home)` are included when available. The general `Time` and `Distance` columns contain the shortest available values. Downloading does not trigger new Google Routes API calculations.


---
# Disclaimer

This extension is provided "as is" and without warranties of any kind, express or implied. The author makes no guarantee that the extension will function correctly, reliably, or continuously, or that the information it displays, processes, filters, or downloads will be complete or accurate.

Use of this extension is entirely at your own risk. The author assumes no responsibility or liability for any errors, omissions, data loss, unintended actions, missed job opportunities, or other damages or consequences arising from the use or inability to use this extension.

This extension is an independent project and is not affiliated with, endorsed by, or supported by Drexel University, or their affiliates. Users are responsible for verifying important information directly through the official Drexel systems before taking action.


---
# Privacy Policy

The extension stores configuration settings, user preferences, cached job information, and cached route information locally using the Chrome Extensions Storage API. This information is used to provide extension functionality and to avoid repeatedly retrieving or calculating the same information.

The extension does not collect or transmit information for analytics, advertising, tracking, profiling, or sale to third parties.

The extension retrieves job-detail pages when needed to display, search, filter, or download job information. Job information may be cached locally on the user's device to reduce repeated requests.

If the user configures a Google Routes API key and uses features that require travel-time or distance calculations, the extension sends configured starting addresses and job destination addresses to the Google Routes API. These requests are made solely to calculate route distances and travel times. Driving and public-transit calculations may be requested separately. The resulting route information may be cached locally on the user's device to reduce repeated API requests.

The Google Routes API key entered in the Options page is stored locally using the Chrome Extensions Storage API and is used when making Google Routes API requests. Users are responsible for their Google Cloud account, API key, API usage, billing, and any restrictions applied to the key.

Route calculations and other interactions with Google services are subject to Google's applicable terms and privacy policies. Users who do not configure a Google Routes API key can use the extension without Google Routes API functionality.

The extension does not intentionally append identifying information to job-detail requests or use its host permissions for tracking, analytics, advertising, or access to unrelated websites.


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

# Configuration

The extension provides an Options page for configuring features that use Google Routes.

The following settings are available:

* **Google Routes API Key** - An optional Google Routes API key used to calculate estimated driving and public-transit distances and times. The Options page includes instructions for obtaining and configuring an API key.

* **Starting Addresses** - Configure one or more starting locations for route calculations. Each address has a customizable name, such as `Home` or `Work`. On job-list pages, driving and transit can be selected independently for each configured address.

* **Distance and Time Cache** - Calculated route distances and times are cached locally to reduce unnecessary Google Routes API requests. Driving and transit results are cached separately. The saved route information can be cleared from the Options page.

Job display preferences, selected starting-address/travel-mode combinations, time and distance display settings, and sorting preferences are remembered separately for the job cart, job search results, and interview request pages.

---
