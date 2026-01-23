# Plan: Enforce Role-Based Access in Manager Dashboard

## Objective

Enhance system stability by enforcing strictly role-based access to manager tabs at the logic level. This ensures that even if restricted tabs (Inventory, Tasks, Employees) are accessed via deep links or navigation state, unauthorized users (non-owners/admins) will be safely redirected to the default 'Sales' view.

## Problem

While we have hidden the UI navigation buttons for restricted features, the `ManagerDashboard` component still accepts `initialTab` from the router state. If a restricted manager inadvertently navigates to a restricted tab (e.g., via browser history or bookmark), the application attempts to render authorized-only components, potentially causing crashes, API errors, or security confusion.

## Proposed Solution (Low Risk)

We will implement a "Safety Guard" in `ManagerDashboard.jsx` using `useEffect`. This guard will check the current `activeTab` against the user's role immediately upon mounting or tab switching.

### Logic

1. Define a list of `RESTRICTED_TABS` = `['inventory', 'tasks', 'employees']`.
2. Check if the `currentUser` is **NOT** an Admin/Owner (`isPrivileged = false`).
3. If `isPrivileged` is false AND `activeTab` is in `RESTRICTED_TABS`:
    * Force `setActiveTab('sales')`.
    * (Optional) Show a fleeting "Access Denied" toast or simply redirect silently.

## Implementation Steps

1. **Modify `src/pages/data-manager-interface/index.jsx`**:
    * Calculate `isPrivileged` boolean inside the component (derived from `currentUser`).
    * Add a `useEffect` hook that depends on `activeTab` and `isPrivileged`.
    * Inside the effect:

        ```javascript
        const restrictedTabs = ['inventory', 'tasks', 'employees'];
        if (!isPrivileged && restrictedTabs.includes(activeTab)) {
            setActiveTab('sales');
        }
        ```

## Risk Assessment

* **Risk Level:** Very Low.
* **Impact:** High stability. Prevents unauthorized components from mounting and triggering potentially failing API calls (`403 Forbidden` or `400 Bad Request`).
* **Rollback:** Easily reversible by removing the `useEffect`.

## Verification

1. Log in as a standard "Manager".
2. Attempt to navigate to the dashboard with state: `{ initialTab: 'inventory' }`.
3. Verify that the dashboard automatically defaults to 'sales' instead of attempting to load Inventory.
