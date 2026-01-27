# iCaffe Self-Service Kiosk & POS System ☕

A comprehensive, offline-first Point of Sale (POS) and self-service kiosk application designed for modern cafes and restaurants. Built with high performance and reliability in mind, handling everything from customer orders to kitchen management and inventory control.

![iCaffe Kiosk](public/og-image.png)

---

## 🚀 Key Features

### 🖥️ Terminals & Interfaces

* **Self-Service Kiosk:** A beautiful, customer-facing interface for browsing menus, customizing items, and paying independently.
* **POS (Point of Sale):** A fast cashier interface for staff to take orders, handle cash/card payments, and manage tables.
* **KDS (Kitchen Display System):** Real-time order routing to kitchen stations (Bar, Kitchen, Pass) with course timing management.
* **Admin Dashboard:** Comprehensive back-office for menu editing, employee timesheets, inventory management, and business analytics.

### ⚙️ Core Capabilities

* **Offline-First Architecture:** Built on top of **Dexie.js** (IndexedDB). The system continues to function seamlessly without internet, syncing data to the cloud when connectivity returns.
* **Inventory Tracking:** Real-time stock deduction based on recipes (e.g., a "Cappuccino" order deducts 18g coffee beans and 200ml milk).
* **Loyalty System:** Built-in customer retention program (Buy 10, get 1 free) with phone number lookup.
* **Printer Integration:** Support for thermal receipt printers (Star/Epson) via raw TCP/network commands.
* **Music Player:** Integrated mini-player for controlling venue ambience.

---

## 🛠️ Tech Stack

### Frontend

* **Framework:** [React 18](https://react.dev/)

* **Build Tool:** [Vite](https://vitejs.dev/)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/) for animations.
* **State Management:** Redux Toolkit + React Context.
* **Local Database:** [Dexie.js](https://dexie.org/) (IndexedDB wrapper).

### Backend (BaaS)

* **Database:** PostgreSQL (via [Supabase](https://supabase.com/)).

* **Business Logic:** Extensive use of PostgreSQL **RPCs** (Remote Procedure Calls) for critical operations like `submit_order` to simplify frontend logic and ensure ACID transactions.
* **Real-time:** Supabase Realtime for instant KDS updates.

---

## 📂 Project Structure

```bash
src/
├── api/                # API service layers
├── assets/             # Images and fonts
├── components/         # Reusable UI components (Buttons, Modals, Cards)
├── context/            # React Contexts (Auth, Theme, Toast)
├── db/                 # Dexie database schema and configuration
├── hooks/              # Custom React hooks (useCart, useLoyalty)
├── layouts/            # Page layouts (Main, Admin, Kiosk)
├── lib/                # Utilities and libraries (Supabase client, formatting)
├── pages/              # Main Route Views
│   ├── dashboard/      # Admin Dashboard view
│   ├── dexie-admin/    # Local DB debugger
│   ├── kds/            # Kitchen Display System
│   ├── menu-ordering/  # The main Ordering Interface
│   ├── mode-selection/ # Terminal mode selector (Home)
│   └── login/          # Auth screens
├── services/           # Background services (Sync, Printers, Queue)
└── store/              # Redux store configuration
```

---

## 🚦 Getting Started

### Prerequisites

* Node.js (v18+)
* npm or yarn

### Installation

1. **Clone the repository**

    ```bash
    git clone https://github.com/your-org/self-service-kiosk.git
    cd self-service-kiosk
    ```

2. **Install Dependencies**

    ```bash
    npm install
    ```

3. **Environment Setup**
    Create a `.env` file based on `.env.example`:

    ```bash
    VITE_SUPABASE_URL=your_project_url
    VITE_SUPABASE_ANON_KEY=your_anon_key
    ```

4. **Run Development Server**

    ```bash
    npm run dev
    ```

    The app will start on port `4028` (or as configured).

---

## 🔄 Sync & Offline Logic

The application uses a **Queue-Based Sync System**:

1. **Action:** User places an order.
2. **Local Save:** Order is effectively "saved" instantly to Dexie (IndexedDB).
3. **Queue:** A sync task is added to `offlineQueue`.
4. **Background Worker:** The `syncService` monitors the queue and network status.
    * *If Online:* Pushes data to Supabase immediately using RPCs.
    * *If Offline:* Retries later when connection is restored.

---

## 🛡️ Security

* **RLS (Row Level Security):** Supabase policies ensure data isolation between tenants (businesses).
* **Employee Roles:** Role-based access control (Admin, Manager, Shift Leader, Staff) effectively manages access to sensitive areas like Sales Reports and Inventory settings.

---

## 🎨 Theme

The application supports a robust theming system (Light/Dark mode) with consistent design tokens, ensuring high visibility in high-paced kitchen environments and elegant aesthetics for customer Kiosks.

---

## 💾 Database Backups

The project includes tools for generating database dumps from the remote Supabase production environment.

* **Latest Dump:** `remote_db_dump.sql` (Generated on 2026-01-27)
* **Status:** Contains 119 tables and 169 functions from the `public`, `auth`, `storage`, and `realtime` schemas.

*Powered by iCaffe* ☕
