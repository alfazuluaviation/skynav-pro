# AI Rules for SkyNav Pro

This document outlines the core technologies and guidelines for developing the SkyNav Pro application.

## Tech Stack

*   **React**: The primary JavaScript library for building the user interface.
*   **TypeScript**: Used for type safety and improved code quality across the entire codebase.
*   **Tailwind CSS**: A utility-first CSS framework for styling all components and ensuring a consistent, responsive design.
*   **Leaflet & React-Leaflet**: Libraries for interactive maps, handling map rendering and interactions.
*   **Supabase**: Utilized for user authentication and potentially future database interactions.
*   **Google Gemini API**: Integrated for AI-powered features, such as aeronautical data synchronization and aerodrome search.
*   **Vite**: The build tool used for a fast development experience and optimized production builds.
*   **DECEA WMS/WFS**: External web services providing real-time aeronautical charts and navigation data.
*   **Custom SVG Icons**: Defined in `src/components/Icons.tsx` for a lightweight and consistent icon set.

## Library Usage Rules

To maintain consistency and efficiency, please adhere to the following guidelines when developing:

*   **User Interface (UI)**: All UI components must be built using **React**.
*   **Styling**: Use **Tailwind CSS** classes exclusively for all styling. Avoid inline styles or custom CSS files unless absolutely necessary for specific Leaflet overrides.
*   **Mapping**: For all map-related functionalities, use **Leaflet** integrated with **React-Leaflet**.
*   **Icons**: Utilize the custom SVG icons provided in `src/components/Icons.tsx`. If a needed icon is not available, add it to this file.
*   **Authentication**: All authentication flows must be handled through **Supabase**.
*   **AI/Generative Features**: Any AI-driven functionality, such as data generation or intelligent search, should leverage the **Google Gemini API**.
*   **Aeronautical Data Interaction**: Direct interaction with DECEA's WMS/WFS services should be encapsulated within the `src/services/NavigationDataService.ts` file.
*   **Routing**: Currently, navigation between main sections is handled within `App.tsx` using state. If more complex, multi-page routing is required, **React Router** should be introduced, with routes defined in `src/App.tsx`.
*   **Component Structure**: Create a new file for every new component or hook in `src/components/`. Keep components focused and small (ideally under 100 lines).