# Changelog

## [2.0.0] - 2025-12-16

### 🎉 Major Release - Production Ready

This release transforms the MVP into a stable, production-ready application.

### ✨ New Features

- **Device Presence Tracking** - Super Admin can see connected KDS devices with IP, user name, and session time
- **Task Management UI** - New TasksManager component in Manager Dashboard with full CRUD operations
- **Order Cancellation** - Cancel unpaid orders directly from KDS
- **Pre-closing Tasks** - Support for tasks that can be started before official closing time

### 🔐 Security & Stability

- **ErrorBoundary** - Generic error boundary component prevents full app crashes
- **RPC Functions** - 6 new SECURITY DEFINER functions to safely bypass RLS:
  - `get_order_for_editing` - Fetch orders for editing
  - `send_device_heartbeat` - Device presence tracking
  - `get_all_business_stats` - Super Admin dashboard stats
  - `confirm_order_payment` - Payment confirmation
  - `cancel_order` - Order cancellation
  - `get_sales_data` - Sales dashboard data
- **Console.log Removal** - Automatic removal in production builds via Terser
- **Key Anti-pattern Fixes** - Fixed all `key={index}` issues in React components

### 🐛 Bug Fixes

- Fixed payment confirmation not updating `paid_amount`
- Fixed orders appearing as unpaid after payment
- Fixed routing to wrong screen after login
- Fixed empty Tasks tab in KDS
- Fixed Sales Dashboard not loading data (RLS issue)
- Fixed PGRST116 error when editing orders from KDS

### 📱 UI/UX Improvements

- **ModeSelectionScreen** - 30% size reduction for better tablet display
- **Cockpit visibility** - Visible on mobile & desktop, hidden on tablet
- **Mobile KDS** - Dedicated route using ManagerKDS component
- **KDS Task Display** - Redesigned with compact rows, green checkmark, video placeholder

### 🏗️ Technical Improvements

- Business ID filtering across all queries
- Heartbeat mechanism for device online status
- Client-side task filtering for Hebrew category support

---

## [0.1.0] - Initial Release

- Basic kiosk functionality
- KDS interface
- Manager dashboard
- Menu management

