## 2024-05-23 - [Optimized StatusBadge and Sidebar Constant Re-creation]
**Learning:** React components (Sidebar, StatusBadge) were defining large constant objects inside the render function. This causes unnecessary object creation and garbage collection pressure on every render.
**Action:** Move constant configuration objects (styles, labels, colors) outside the component function to module scope.
