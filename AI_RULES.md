# AI Rules for SkyFPL

This document outlines the core technologies and guidelines for developing the SkyFPL application.

## Tech Stack

*   **React**: The primary JavaScript library for building the user interface.
*   **TypeScript**: Used for type safety and improved code quality across the entire codebase.
*   **Tailwind CSS**: A utility-first CSS framework for styling all components and ensuring a consistent, responsive design.
*   **Leaflet & React-Leaflet**: Libraries for interactive maps, handling map rendering and interactions.
*   **Supabase**: Backend-as-a-service for authentication, database, and edge functions.

## Guidelines

1.  **Component Structure**: Keep components small and focused. Create new files for new components.
2.  **Styling**: Use Tailwind CSS utility classes. Avoid custom CSS when possible.
3.  **State Management**: Use React hooks (`useState`, `useEffect`, `useCallback`) for local state.
4.  **Type Safety**: Always define TypeScript interfaces for props and data structures.
5.  **Mobile First**: Design for mobile devices first, then enhance for desktop.
6.  **Performance**: Optimize for performance, especially on map interactions.
