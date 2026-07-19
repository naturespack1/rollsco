# QZ Tray ESC/POS auto-cut setup

The app can print raw ESC/POS receipts and issue a **full paper cut** (`GS V 0`) after every chef or customer receipt. This requires QZ Tray to be installed and running on the same computer where the admin screen is open.

## One-time setup

1. Install the thermal printer's normal Windows/macOS/Linux driver and confirm it prints from the operating system.
   - For a USB printer, connect it to this computer and install its driver.
   - For a LAN printer, add its IP printer/driver to this computer first.
2. Install and start [QZ Tray](https://qz.io/download/).
3. Open **Admin → Active Orders** in the app.
4. Under **Use QZ Tray ESC/POS printing with auto-cut**, click **Find printers**.
5. Choose the installed printer, enable the checkbox, and click **Save print mode**.
6. Click **Test print & cut**. It should print a short test and physically cut the paper.

The setting and selected printer are saved in the browser's local storage for that browser profile.

## Notes

- Every raw chef receipt is sent as its own print job, so a batch of new orders gets one cut per order.
- If QZ mode is off, the existing browser print-window behaviour remains unchanged.
- The printer must support ESC/POS cutting and have an enabled cutter. If it only feeds paper, check the printer model/driver and cutter setting.
- QZ Tray may show a security/trust confirmation when an unsigned web app first sends print jobs. For unattended production printing, configure QZ Tray certificate signing according to QZ Tray's deployment documentation.
