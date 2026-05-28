# Implementation Plan: Frontend Bug Fixes and Improvements

## Overview

This implementation plan addresses critical bugs and UI improvements in the frontend application. The work is organized into discrete tasks that build incrementally, starting with route parameter fixes, then implementing missing functionality, and finally adding UI enhancements. Each task includes specific file modifications and testing requirements.

## Tasks

- [ ] 1. Fix route parameter extraction in AppLayout
  - Update `AppLayout.tsx` to use strict parameter extraction from TanStack Router
  - Change `useParams({ strict: false })` to `useParams({ from: '/workspaces/$workspaceId/$tab' })`
  - Ensure workspaceId is correctly typed and extracted
  - Verify workspace data fetching uses the extracted parameter
  - _Requirements: 9.2, 1.3_

- [ ] 1.1 Write property test for route parameter extraction
  - **Property 1: Route Parameter Extraction**
  - **Validates: Requirements 9.2, 1.3**

- [ ] 2. Fix missing icon imports in ChatTab
  - Import `Paperclip`, `Tag`, and `Link` icons from lucide-react
  - Replace undefined icon references in the chat input area
  - Verify icons render correctly in the UI
  - _Requirements: 3.1_

- [ ] 2.1 Write unit test for ChatTab icon rendering
  - Test that all icons are present in the rendered component
  - _Requirements: 3.1_

- [ ] 3. Implement chat session creation and context handling
  - [ ] 3.1 Fix new session creation flow
    - Ensure `activeSession` is set after first message when no session exists
    - Update `handleSend` to properly handle the response from `useSendChatMessage`
    - Verify session ID is stored in state after creation
    - _Requirements: 3.2_
  
  - [ ] 3.2 Write property test for session ID generation
    - **Property 7: Unique Session ID Generation**
    - **Validates: Requirements 3.2**
  
  - [ ] 3.3 Verify workspace context in chat requests
    - Ensure all API hooks receive `workspaceId` parameter
    - Verify `useSendChatMessage` includes workspace context
    - _Requirements: 3.1_
  
  - [ ] 3.4 Write property test for chat message context
    - **Property 6: Chat Message Context Inclusion**
    - **Validates: Requirements 3.1**

- [ ] 4. Implement share link display and copy functionality
  - [ ] 4.1 Add share URL display after creation
    - Ensure `lastShareUrl` is set after successful share creation
    - Construct full URL with origin: `${window.location.origin}/shares/${token}`
    - Display the URL prominently with copy button
    - _Requirements: 4.1, 4.3_
  
  - [ ] 4.2 Write property test for share URL generation
    - **Property 10: Share Link URL Generation**
    - **Validates: Requirements 4.1**
  
  - [ ] 4.3 Implement auto-copy to clipboard
    - Call `navigator.clipboard.writeText()` after share creation
    - Wrap in try-catch for error handling
    - Show success toast on successful copy
    - _Requirements: 4.2_
  
  - [ ] 4.4 Write property test for clipboard auto-copy
    - **Property 11: Clipboard Auto-Copy**
    - **Validates: Requirements 4.2**
  
  - [ ] 4.5 Add manual copy button functionality
    - Implement copy button click handler
    - Copy URL to clipboard and show toast
    - Handle clipboard API errors gracefully
    - _Requirements: 4.4_
  
  - [ ] 4.6 Write property test for copy button
    - **Property 13: Copy Button Functionality**
    - **Validates: Requirements 4.4**

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement audit log filtering
  - [ ] 6.1 Add filter panel state and UI
    - Add `filterOpen` state to AuditTab
    - Add `eventTypeFilter` and `dateRangeFilter` state
    - Create filter panel component with event type checkboxes
    - Add date range picker inputs
    - _Requirements: 5.2_
  
  - [ ] 6.2 Write unit test for filter panel display
    - Test that clicking Filter button opens panel
    - _Requirements: 5.2_
  
  - [ ] 6.3 Implement filter logic
    - Update `filtered` memo to apply event type and date range filters
    - Combine search query with filter criteria
    - Ensure pagination works with filters
    - _Requirements: 5.1, 5.3, 5.5_
  
  - [ ]* 6.4 Write property test for audit log filtering
    - **Property 15: Audit Log Filtering**
    - **Validates: Requirements 5.1, 5.3**
  
  - [ ]* 6.5 Write property test for filter restoration
    - **Property 16: Filter State Restoration**
    - **Validates: Requirements 5.4**
  
  - [ ]* 6.6 Write property test for pagination with filters
    - **Property 17: Pagination with Filters**
    - **Validates: Requirements 5.5**

- [ ] 7. Enhance sign out button visibility
  - Update sign out button styling in AppLayout sidebar footer
  - Use destructive color scheme: `text-destructive hover:text-destructive`
  - Add background on hover: `hover:bg-destructive/10`
  - Ensure icon and text are clearly visible
  - _Requirements: 7.2, 7.4_

- [ ]* 7.1 Write unit test for sign out button
  - Test that button contains icon and "Sign Out" text
  - Test that button is in sidebar footer
  - _Requirements: 7.2, 7.4_

- [ ] 8. Add interactive hover animations
  - [ ] 8.1 Add hover effects to Brand component
    - Add `interactive` prop to Brand component interface
    - Implement scale transform on hover: `hover:scale-105`
    - Add smooth transition: `transition-transform duration-200 ease-out`
    - Apply glow effect: `hover:drop-shadow-glow`
    - _Requirements: 8.1_
  
  - [ ] 8.2 Enhance workspace card hover effects
    - Update workspace card styles in workspaces.tsx
    - Add scale transform: `hover:scale-[1.02]`
    - Enhance glow effect on border
    - Ensure smooth transitions
    - _Requirements: 8.2_
  
  - [ ] 8.3 Add navigation item hover transitions
    - Update navigation link styles in AppLayout
    - Add smooth color transitions
    - Enhance background color change on hover
    - _Requirements: 8.3_

- [ ] 9. Implement modal accessibility improvements
  - [ ] 9.1 Add focus trap to modals
    - Implement focus management in settings and profile modals
    - Trap focus within modal when open
    - Restore focus to trigger element on close
    - _Requirements: 6.5_
  
  - [ ]* 9.2 Write property test for focus restoration
    - **Property 20: Focus Restoration**
    - **Validates: Requirements 6.5**
  
  - [ ] 9.3 Add Escape key handler
    - Implement Escape key listener for modal dismissal
    - Clean up listener on unmount
    - _Requirements: 6.4_
  
  - [ ]* 9.4 Write property test for modal dismissal
    - **Property 19: Modal Dismissal**
    - **Validates: Requirements 6.4**
  
  - [ ] 9.5 Prevent background interaction
    - Ensure modal overlay prevents clicks from reaching background
    - Use `event.stopPropagation()` on modal content
    - _Requirements: 6.3_
  
  - [ ]* 9.6 Write property test for background interaction prevention
    - **Property 18: Modal Background Interaction Prevention**
    - **Validates: Requirements 6.3**

- [ ] 10. Add loading and error states
  - [ ] 10.1 Implement loading indicators
    - Add skeleton loaders to tab components during data fetch
    - Show loading spinners for async operations
    - _Requirements: 10.1_
  
  - [ ]* 10.2 Write property test for loading state feedback
    - **Property 22: Loading State Feedback**
    - **Validates: Requirements 10.1**
  
  - [ ] 10.3 Implement error message display
    - Add error boundaries for component-level errors
    - Display user-friendly error messages in toast notifications
    - Show error states in tab components
    - _Requirements: 10.2_
  
  - [ ]* 10.4 Write property test for error message display
    - **Property 23: Error Message Display**
    - **Validates: Requirements 10.2**
  
  - [ ] 10.5 Add retry functionality
    - Implement retry buttons in error states
    - Use React Query's retry configuration
    - _Requirements: 10.3_
  
  - [ ]* 10.6 Write property test for retry options
    - **Property 24: Retry Options on Failure**
    - **Validates: Requirements 10.3**

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Integration testing and verification
  - [ ] 12.1 Test workspace navigation flow
    - Verify clicking workspace card navigates correctly
    - Verify tab switching works smoothly
    - Verify breadcrumb updates correctly
    - _Requirements: 1.1, 1.2, 2.4_
  
  - [ ] 12.2 Test chat functionality end-to-end
    - Verify new session creation
    - Verify message sending with context
    - Verify source display
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ] 12.3 Test share link workflow
    - Verify share creation and URL display
    - Verify clipboard copy functionality
    - Verify share revocation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ] 12.4 Test audit log filtering
    - Verify search functionality
    - Verify filter panel and application
    - Verify pagination with filters
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end user flows
