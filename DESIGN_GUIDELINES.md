# Design Guidelines / הנחיות עיצוב

## ⚠️ CRITICAL: NO DESIGN CHANGES WITHOUT EXPLICIT USER APPROVAL

This document outlines the design guidelines for this project.

### Rule #1: Do NOT change styling without explicit permission

**Before making ANY design/styling changes, you MUST:**
1. Ask the user explicitly if they want design changes
2. Get explicit approval for the specific changes
3. Only then proceed with the changes

**This applies to:**
- CSS/styling changes
- Component layouts
- Colors, fonts, spacing
- Modal designs
- Button styles
- Any visual changes

### Current Design Language
- **Primary Color**: Slate-900 for headers
- **Accent Color**: Orange-500 for action buttons
- **Success Color**: Green-500 for completed/marked items
- **Background**: White/Slate-50 for content areas
- **Border radius**: rounded-xl (12px) for buttons, rounded-2xl (16px) for modals
- **Font**: System font with Hebrew support (RTL)

### Protected Components (Do NOT modify design without approval)
1. `OrderEditModal.jsx` - KDS quick edit modal
2. `OrderCard.jsx` - KDS order cards
3. `PaymentSelectionModal.jsx` - Payment selection
4. `OrderConfirmationModal.jsx` - Order confirmation popup

### Approved Design Patterns
- Simple, clean layouts
- Table-like lists with divide-y separators
- Minimal shadows and borders
- Clear visual hierarchy
- RTL support throughout

---

## הוספות/שינויים מותרים ללא אישור:
1. תיקוני באגים שלא משנים את המראה
2. שיפורי ביצועים
3. הוספת תכונות חדשות שלא משנות עיצוב קיים
4. תיקוני נגישות (accessibility)

## שינויים שדורשים אישור מפורש:
1. שינוי צבעים
2. שינוי גודל/צורה של אלמנטים
3. הוספת אנימציות
4. שינוי layout
5. הוספת גרדיאנטים או אפקטים ויזואליים
6. שינוי עיצוב של מודלים או כרטיסים

---

**Last Updated**: 2025-12-25
**Author**: System Guidelines
