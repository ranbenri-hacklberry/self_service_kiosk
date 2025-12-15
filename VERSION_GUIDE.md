# Version Management Guide

## Current Version
**β 0.9.0** (2025-11-25)

## How to Update Version

Every time you make a significant change to the app, update the version number:

1. Open `src/config/version.js`
2. Update the version number:
   - **Beta versions** (β 0.x.x): During development and testing
   - **Release versions** (v1.x.x): When ready for production
   - Increment:
     - **MAJOR** (β 1.0.0 → v1.0.0): First stable release
     - **MINOR** (β 0.9.0 → β 0.10.0): New features
     - **PATCH** (β 0.9.0 → β 0.9.1): Bug fixes
3. Update `VERSION_DATE` to today's date
4. Update `VERSION_NOTES` with a brief description of changes
5. Commit the changes

## Version History

### β 0.9.0 (2025-11-25)
- **Fixed**: Modifier prices not being added for soy/oat milk
- **Changed**: Field name from `price_adjustment` to `priceAdjustment` to match API normalization
- **Added**: Version number display on welcome screen
- **Added**: Version management system

### β 0.8.0 (Previous)
- SMS integration for order notifications
- KDS improvements
- Modifier UI polish

### β 0.1.0 (Initial)
- Initial beta release
- Self-service kiosk functionality
- Menu ordering interface
- KDS (Kitchen Display System)

## Where Version Appears

The version number appears at the bottom of the welcome screen (customer phone input screen) in small gray text.

This allows you to quickly verify which version is running on the iPad without needing to check the code.
