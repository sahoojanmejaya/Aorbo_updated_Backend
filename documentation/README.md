# Vendor Panel Documentation

This documentation provides comprehensive analysis of the vendor panel project, including frontend and backend codebases, field mappings, API endpoints, and visual flow representations.

## Project Overview

The vendor panel is a comprehensive trekking and adventure booking platform that allows vendors to:

- Manage trek listings and itineraries
- Handle bookings and customer interactions
- Process payments and manage finances
- Track analytics and performance metrics
- Manage locations, activities, and trek captains

## Module Structure

The project is organized into the following functional modules:

### Core Modules

1. **Authentication & Authorization** - User login, registration, and role-based access
2. **Trek Management** - Create, edit, and manage trek listings with full details
3. **Booking Management** - Handle customer bookings, payments, and status updates
4. **Customer Management** - Manage customer profiles and interactions
5. **Analytics & Dashboard** - Performance metrics and business insights

### Supporting Modules

6. **Location Management** - Destinations, cities, states, and boarding points
7. **Activity Management** - Trek activities, inclusions, and exclusions
8. **Trek Captain Management** - Guide profiles and assignments
9. **Review & Rating System** - Customer feedback and ratings
10. **Coupon & Discount Management** - Promotional offers and discounts
11. **Hold Request Management** - Temporary booking holds
12. **Profile & Settings** - Vendor profile and account settings

## Documentation Files

Each module has its own comprehensive documentation file:

- [Authentication Module](./modules/authentication.md)
- [Trek Management Module](./modules/trek-management.md)
- [Booking Management Module](./modules/booking-management.md)
- [Customer Management Module](./modules/customer-management.md)
- [Analytics & Dashboard Module](./modules/analytics-dashboard.md)
- [Location Management Module](./modules/location-management.md)
- [Activity Management Module](./modules/activity-management.md)
- [Trek Captain Management Module](./modules/trek-captain-management.md)
- [Review & Rating Module](./modules/review-rating.md)
- [Coupon Management Module](./modules/coupon-management.md)
- [Hold Request Module](./modules/hold-request.md)
- [Profile & Settings Module](./modules/profile-settings.md)

## Technology Stack

### Backend

- **Framework**: Node.js with Express.js
- **Database**: MySQL with Sequelize ORM
- **Authentication**: JWT tokens
- **File Upload**: Base64 image handling
- **Payment**: Razorpay integration

### Frontend

- **Framework**: React with Vite
- **UI Library**: Shadcn/ui components
- **State Management**: React hooks
- **Routing**: React Router
- **Styling**: Tailwind CSS

## API Structure

All vendor APIs are prefixed with `/api/vendor/` and require authentication except for login/register endpoints.

## Database Schema

The application uses a comprehensive database schema with the following main tables:

- `vendors` - Vendor profiles and business information
- `treks` - Trek listings and details
- `bookings` - Customer bookings and payments
- `customers` - Customer profiles
- `trek_captains` - Guide profiles
- `destinations`, `cities`, `states` - Location management
- `activities`, `inclusions`, `exclusions` - Trek features
- `reviews`, `ratings` - Customer feedback
- `coupons` - Promotional offers

## Development Guidelines

### Field Mapping

Each module documentation includes detailed field mappings between:

- Frontend form fields and state variables
- Backend API parameters
- Database table columns

### API Documentation

Each API endpoint is documented with:

- HTTP method and URL
- Request/response payloads
- Authentication requirements
- Error handling

### Visual Flows

Mermaid diagrams illustrate:

- User interaction flows
- API call sequences
- Database operations
- State transitions

## Getting Started

1. Review the module documentation for your specific area of interest
2. Examine the field mappings to understand data flow
3. Study the API documentation for integration points
4. Follow the visual flow diagrams for process understanding

## Contributing

When adding new features or modifying existing ones:

1. Update the relevant module documentation
2. Add field mappings for new forms
3. Document new API endpoints
4. Create visual flow diagrams for new processes
