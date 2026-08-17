export type ModuleData = {
  module_number: number;
  title: string;
  description: string;
  weeks: number;
  days: number;
  hours: number;
  start_day: number;
  end_day: number;
};

export type DayData = {
  day_number: number;
  module_number: number;
  week_number: number;
  topic: string;
  content: string;
  subtopics: string[];
  project_information: string | null;
  assessment_information: string | null;
};

// ─── Modules ────────────────────────────────────────────────────────────────

export const modules: ModuleData[] = [
  {
    module_number: 1,
    title: "Foundation: Git, Terminal, Python, OOP & DSA",
    description:
      "Core programming foundations covering version control, command line, Python fundamentals, object-oriented programming, design principles, and data structures & algorithms.",
    weeks: 2,
    days: 10,
    hours: 40,
    start_day: 1,
    end_day: 10,
  },
  {
    module_number: 2,
    title: "Frontend: HTML, CSS & JavaScript",
    description:
      "Web development fundamentals covering semantic HTML, responsive CSS, JavaScript core concepts, DOM manipulation, async programming, and REST APIs.",
    weeks: 3,
    days: 15,
    hours: 60,
    start_day: 11,
    end_day: 25,
  },
  {
    module_number: 3,
    title: "Frontend: React & Next.js",
    description:
      "Modern React development with hooks, state management, routing, Next.js App Router, server components, API routes, and full-stack project building.",
    weeks: 5,
    days: 25,
    hours: 100,
    start_day: 26,
    end_day: 50,
  },
  {
    module_number: 4,
    title: "Backend Track",
    description:
      "Server-side development with Node.js and Express, REST API design, authentication, middleware, Python web frameworks, and backend project building.",
    weeks: 5,
    days: 25,
    hours: 100,
    start_day: 51,
    end_day: 75,
  },
  {
    module_number: 5,
    title: "Databases",
    description:
      "Relational databases with PostgreSQL, SQL mastery, ORMs with Prisma, NoSQL with MongoDB, and database design patterns.",
    weeks: 2,
    days: 10,
    hours: 40,
    start_day: 76,
    end_day: 85,
  },
  {
    module_number: 6,
    title: "QA & Testing",
    description:
      "Software testing fundamentals, unit testing, integration testing, test-driven development, and end-to-end testing.",
    weeks: 1,
    days: 5,
    hours: 20,
    start_day: 86,
    end_day: 90,
  },
  {
    module_number: 7,
    title: "DevOps & CI/CD",
    description:
      "Linux fundamentals, Docker containerization, CI/CD pipelines, cloud deployment, and monitoring.",
    weeks: 2,
    days: 10,
    hours: 40,
    start_day: 91,
    end_day: 100,
  },
  {
    module_number: 8,
    title: "Software Architecture & Design",
    description:
      "Architectural patterns, system design, API design, documentation, portfolio building, and final capstone project.",
    weeks: 1,
    days: 5,
    hours: 20,
    start_day: 101,
    end_day: 105,
  },
];

// ─── Module 1: Foundation (Days 1–10) ──────────────────────────────────────

const module1Days: DayData[] = [
  {
    day_number: 1,
    module_number: 1,
    week_number: 1,
    topic: "Environment Setup, Git & Terminal",
    content:
      "Set up a professional development environment. Install VS Code, Python, Node.js, and Git. Learn terminal fundamentals: navigating directories, file operations, and running programs. Initialize a Git repository, understand commits, branches, and basic Git workflow.",
    subtopics: [
      "VS Code setup and extensions",
      "Python installation and virtual environments",
      "Node.js and npm installation",
      "Git installation and configuration",
      "Terminal basics: cd, ls, mkdir, rm, cat",
      "Git init, add, commit, status, log",
      "Branching: branch, checkout, merge",
      "README.md writing",
    ],
    project_information:
      "Set up your development environment from scratch. Create a GitHub repository with a proper README, .gitignore, and initial commit. Document your setup process.",
    assessment_information:
      "Environment setup verification: Git, Python, Node.js all installed and configured. Repository created with at least 3 commits.",
  },
  {
    day_number: 2,
    module_number: 1,
    week_number: 1,
    topic: "Python Fundamentals",
    content:
      "Learn Python basics: variables, data types, operators, input/output, and control flow. Understand dynamic typing, string operations, and basic I/O with users.",
    subtopics: [
      "Python syntax and indentation",
      "Variables and naming conventions",
      "Data types: int, float, str, bool",
      "Type conversion and casting",
      "String operations and f-strings",
      "Input/output with input() and print()",
      "Operators: arithmetic, comparison, logical",
      "Comments and code documentation",
    ],
    project_information:
      "Build a simple calculator that takes two numbers and an operator from the user and outputs the result. Extend it to handle multiple operations in a loop.",
    assessment_information:
      "Quiz on Python data types, operators, and string formatting. Practical: write 5 small programs demonstrating variables, input/output, and type conversion.",
  },
  {
    day_number: 3,
    module_number: 1,
    week_number: 1,
    topic: "Python Collections, Files & Errors",
    content:
      "Master Python collections: lists, tuples, dictionaries, and sets. Learn file I/O operations for reading and writing files. Understand exception handling with try/except blocks.",
    subtopics: [
      "Lists: creation, indexing, slicing, methods",
      "Tuples and immutability",
      "Dictionaries: keys, values, items, methods",
      "Sets and set operations",
      "List comprehensions",
      "File reading: open(), read(), readline()",
      "File writing: write(), writelines()",
      "Context managers (with statement)",
      "Exception handling: try, except, finally",
      "Common exceptions: ValueError, FileNotFoundError",
    ],
    project_information:
      "Build a contact book that stores contacts in a JSON file. Support add, search, list, and delete operations. Handle file errors gracefully.",
    assessment_information:
      "Practical: manipulate lists and dictionaries to solve data transformation problems. File I/O exercise: read a CSV file and compute summary statistics.",
  },
  {
    day_number: 4,
    module_number: 1,
    week_number: 1,
    topic: "OOP I — Classes, Objects & Encapsulation",
    content:
      "Introduction to object-oriented programming. Define classes with attributes and methods. Understand constructors (__init__), instance vs class variables, and encapsulation with access modifiers.",
    subtopics: [
      "Classes and objects",
      "__init__ constructor",
      "Instance attributes and methods",
      "Class variables and methods (@classmethod)",
      "Static methods (@staticmethod)",
      "Encapsulation: public, protected, private",
      "Name mangling with double underscores",
      "Getter and setter patterns",
      "__str__ and __repr__ methods",
    ],
    project_information:
      "Design a BankAccount class with deposit, withdraw, transfer, and balance check methods. Implement proper encapsulation with private balance.",
    assessment_information:
      "OOP concepts quiz: classes, objects, encapsulation. Practical: implement a Student class with grades tracking and GPA calculation.",
  },
  {
    day_number: 5,
    module_number: 1,
    week_number: 1,
    topic: "OOP II — Inheritance, Polymorphism & Abstraction",
    content:
      "Advanced OOP concepts: single and multiple inheritance, method overriding, polymorphism, abstract classes, and interfaces. Understand the Liskov Substitution Principle.",
    subtopics: [
      "Single inheritance",
      "Multiple inheritance and MRO",
      "Method overriding",
      "super() function",
      "Polymorphism and duck typing",
      "Abstract classes (abc module)",
      "Interfaces and protocols",
      "Liskov Substitution Principle",
      "isinstance() and type checking",
    ],
    project_information:
      "Build a shape hierarchy: Shape base class with Circle, Rectangle, and Triangle subclasses. Each implements area() and perimeter() differently.",
    assessment_information:
      "Quiz on inheritance, polymorphism, and abstract classes. Practical: extend the BankAccount hierarchy with SavingsAccount and CheckingAccount.",
  },
  {
    day_number: 6,
    module_number: 1,
    week_number: 2,
    topic: "SOLID Principles & Design Patterns",
    content:
      "Learn the five SOLID principles of object-oriented design. Study common design patterns: Singleton, Factory, Observer, and Strategy. Understand when and why to apply each pattern.",
    subtopics: [
      "Single Responsibility Principle",
      "Open/Closed Principle",
      "Liskov Substitution Principle",
      "Interface Segregation Principle",
      "Dependency Inversion Principle",
      "Singleton pattern",
      "Factory pattern",
      "Observer pattern",
      "Strategy pattern",
      "When to use design patterns",
    ],
    project_information:
      "Refactor a monolithic notification system using SOLID principles. Implement a Factory pattern for creating different notification types (email, SMS, push).",
    assessment_information:
      "SOLID principles quiz with real-world scenarios. Identify code smells and suggest pattern-based solutions.",
  },
  {
    day_number: 7,
    module_number: 1,
    week_number: 2,
    topic: "DSA I — Linear Structures & Big-O",
    content:
      "Introduction to data structures and algorithms. Learn Big-O notation for time and space complexity. Implement arrays, linked lists, stacks, and queues from scratch.",
    subtopics: [
      "Big-O notation: O(1), O(n), O(n²), O(log n)",
      "Time vs space complexity",
      "Arrays vs linked lists",
      "Singly linked list implementation",
      "Doubly linked list",
      "Stack: push, pop, peek",
      "Queue: enqueue, dequeue",
      "When to use each structure",
      "Python list as dynamic array",
    ],
    project_information:
      "Implement a LinkedList class with insert, delete, search, and reverse operations. Compare performance with Python lists for different operations.",
    assessment_information:
      "Big-O analysis exercises: determine complexity of given algorithms. Implement and test stack and queue using linked lists.",
  },
  {
    day_number: 8,
    module_number: 1,
    week_number: 2,
    topic: "DSA II — Recursion, Searching & Sorting",
    content:
      "Master recursion and its applications. Implement binary search and linear search. Study sorting algorithms: bubble sort, selection sort, insertion sort, merge sort, and quicksort.",
    subtopics: [
      "Recursion fundamentals and base cases",
      "Recursion vs iteration",
      "Factorial and Fibonacci with recursion",
      "Linear search: O(n)",
      "Binary search: O(log n)",
      "Bubble sort: O(n²)",
      "Selection sort: O(n²)",
      "Insertion sort: O(n²)",
      "Merge sort: O(n log n)",
      "Quicksort: O(n log n) average",
      "Recursion depth and stack overflow",
    ],
    project_information:
      "Implement all sorting algorithms and benchmark them against different input sizes. Create a visualizer that shows each sorting step.",
    assessment_information:
      "Recursion problem set: Tower of Hanoi, power calculation, palindrome check. Sorting algorithm comparison and analysis.",
  },
  {
    day_number: 9,
    module_number: 1,
    week_number: 2,
    topic: "DSA III — Trees, Graphs & Heaps",
    content:
      "Learn tree data structures: binary trees, binary search trees, and traversal algorithms. Introduction to graphs and graph traversal (BFS, DFS). Study heap data structure and priority queues.",
    subtopics: [
      "Binary tree concepts",
      "Binary search tree (BST)",
      "BST operations: insert, search, delete",
      "Tree traversals: in-order, pre-order, post-order",
      "Breadth-first search (BFS)",
      "Depth-first search (DFS)",
      "Graph representation: adjacency list, matrix",
      "Heap data structure",
      "Min-heap and max-heap",
      "Priority queue implementation",
    ],
    project_information:
      "Implement a BST with all traversal methods. Build a simple graph and perform BFS/DFS to find paths between nodes.",
    assessment_information:
      "Tree traversal exercises with pen-and-paper and code. Graph problems: detect cycle, find connected components.",
  },
  {
    day_number: 10,
    module_number: 1,
    week_number: 2,
    topic: "Foundation Review & Assessment",
    content:
      "Comprehensive review of all Module 1 topics. Solve coding challenges combining Python, OOP, and DSA concepts. Identify strengths and areas for improvement before moving to frontend development.",
    subtopics: [
      "Git workflow review",
      "Python best practices recap",
      "OOP design exercise",
      "SOLID principles application",
      "DSA problem-solving marathon",
      "Time complexity analysis",
      "Code review and refactoring",
      "Foundation assessment test",
    ],
    project_information:
      "Solve 10 coding challenges covering Python, OOP, and DSA. Refactor previous projects using SOLID principles and design patterns.",
    assessment_information:
      "Comprehensive foundation assessment: coding challenges, algorithm analysis, OOP design problem, and code review.",
  },
];

// ─── Module 2: Frontend — HTML, CSS & JavaScript (Days 11–25) ──────────────

const module2Days: DayData[] = [
  {
    day_number: 11,
    module_number: 2,
    week_number: 3,
    topic: "HTML Fundamentals",
    content:
      "Learn semantic HTML5 elements and document structure. Understand the box model concept, forms, inputs, and accessibility attributes. Create well-structured web pages.",
    subtopics: [
      "HTML5 document structure",
      "Semantic elements: header, nav, main, article, section, footer",
      "Headings hierarchy (h1-h6)",
      "Links, images, and media",
      "Lists: ordered, unordered, description",
      "Tables and proper markup",
      "Forms: input types, labels, validation",
      "Accessibility: alt, aria, roles",
      "Meta tags and SEO basics",
    ],
    project_information:
      "Build a personal portfolio HTML page with semantic structure, contact form, and project gallery. Focus on accessibility and SEO.",
    assessment_information:
      "HTML quiz covering semantic elements, forms, and accessibility. Code review of portfolio page structure.",
  },
  {
    day_number: 12,
    module_number: 2,
    week_number: 3,
    topic: "CSS Fundamentals",
    content:
      "Master CSS selectors, the box model, and layout fundamentals. Learn about specificity, inheritance, and the cascade. Style web pages with clean, maintainable CSS.",
    subtopics: [
      "CSS selectors: element, class, ID, attribute",
      "Combinators: descendant, child, sibling",
      "Specificity and cascade rules",
      "Box model: margin, border, padding, content",
      "Display types: block, inline, inline-block, none",
      "Position: static, relative, absolute, fixed, sticky",
      "Color, background, and typography",
      "Units: px, em, rem, %, vh, vw",
      "CSS custom properties (variables)",
    ],
    project_information:
      "Style the HTML portfolio page from Day 11. Implement a clean, modern design with proper spacing and typography.",
    assessment_information:
      "CSS specificity exercises. Layout challenge: recreate a given design using only CSS fundamentals.",
  },
  {
    day_number: 13,
    module_number: 2,
    week_number: 3,
    topic: "Flexbox & CSS Grid",
    content:
      "Master modern CSS layout systems: Flexbox for one-dimensional layouts and CSS Grid for two-dimensional layouts. Learn responsive design patterns.",
    subtopics: [
      "Flexbox container and items",
      "Flex direction, wrap, and flow",
      "Justify-content and align-items",
      "Flex-grow, flex-shrink, flex-basis",
      "CSS Grid container and items",
      "Grid template columns and rows",
      "Grid gap, area, and placement",
      "Responsive design with media queries",
      "Mobile-first approach",
      "Container queries",
    ],
    project_information:
      "Build a responsive dashboard layout using CSS Grid and Flexbox. Must work on mobile, tablet, and desktop.",
    assessment_information:
      "Layout challenges: recreate complex layouts using Flexbox and Grid. Responsive design test with different viewport sizes.",
  },
  {
    day_number: 14,
    module_number: 2,
    week_number: 3,
    topic: "CSS Transitions, Animations & Advanced Patterns",
    content:
      "Add motion to web pages with CSS transitions and animations. Learn advanced CSS patterns including pseudo-elements, selectors, and modern techniques.",
    subtopics: [
      "CSS transitions: property, duration, timing",
      "Hover and focus effects",
      "CSS keyframe animations",
      "Transform: translate, rotate, scale",
      "Pseudo-elements: ::before, ::after",
      "Advanced selectors: :nth-child, :not, :has",
      "CSS filters and blend modes",
      "Scroll-driven animations",
      "Reduced motion preferences",
    ],
    project_information:
      "Add animations and transitions to the portfolio page. Create a loading animation, hover effects on cards, and smooth page transitions.",
    assessment_information:
      "Animation exercises: create specific effects using transitions and keyframes. Identify performance implications of different CSS properties.",
  },
  {
    day_number: 15,
    module_number: 2,
    week_number: 4,
    topic: "JavaScript Fundamentals",
    content:
      "Start learning JavaScript: variables, data types, operators, control flow, and functions. Understand the difference between var, let, and const. Learn scope and hoisting.",
    subtopics: [
      "JavaScript basics and syntax",
      "Variables: var, let, const",
      "Primitive types and reference types",
      "Operators and expressions",
      "Control flow: if, else, switch",
      "Loops: for, while, do-while, for...of",
      "Functions: declaration, expression, arrow",
      "Parameters, arguments, return values",
      "Scope: global, function, block",
      "Hoisting and temporal dead zone",
    ],
    project_information:
      "Build a number guessing game in the console. The program generates a random number and gives hints (higher/lower) until guessed.",
    assessment_information:
      "JavaScript fundamentals quiz. Coding exercises: write functions for common operations (factorial, fibonacci, palindrome).",
  },
  {
    day_number: 16,
    module_number: 2,
    week_number: 4,
    topic: "JavaScript Arrays & Objects",
    content:
      "Master JavaScript arrays and objects. Learn array methods (map, filter, reduce, find, some, every) and object manipulation. Understand destructuring and spread/rest operators.",
    subtopics: [
      "Array creation and methods",
      "push, pop, shift, unshift, splice",
      "forEach, map, filter, reduce",
      "find, findIndex, some, every",
      "Destructuring arrays and objects",
      "Spread operator (...)",
      "Rest parameters",
      "Object.keys(), values(), entries()",
      "Object.assign() and spread",
      "Optional chaining (?.)",
      "Nullish coalescing (??)",
    ],
    project_information:
      "Build a todo list manager using arrays and objects. Support add, complete, delete, filter, and sort operations.",
    assessment_information:
      "Array methods exercises: transform data using map, filter, reduce. Object manipulation challenges.",
  },
  {
    day_number: 17,
    module_number: 2,
    week_number: 4,
    topic: "DOM Manipulation",
    content:
      "Learn to interact with the Document Object Model. Select elements, create and modify content, handle events, and build dynamic user interfaces.",
    subtopics: [
      "What is the DOM",
      "Selecting elements: querySelector, getElementById",
      "Modifying content: textContent, innerHTML",
      "Modifying styles: classList, style",
      "Creating and removing elements",
      "Event listeners and event objects",
      "Event bubbling and delegation",
      "Form handling and validation",
      "Keyboard and mouse events",
      "Performance considerations",
    ],
    project_information:
      "Build an interactive todo app in the browser. Add, complete, delete, and filter todos with DOM manipulation. Persist in localStorage.",
    assessment_information:
      "DOM manipulation exercises: build dynamic UI components. Event handling quiz with practical scenarios.",
  },
  {
    day_number: 18,
    module_number: 2,
    week_number: 4,
    topic: "Asynchronous JavaScript",
    content:
      "Understand asynchronous programming in JavaScript. Learn callbacks, Promises, and async/await. Handle asynchronous operations like API calls and file operations.",
    subtopics: [
      "Synchronous vs asynchronous code",
      "Callbacks and callback hell",
      "Promises: creation, chaining",
      "Promise.all, Promise.race, Promise.allSettled",
      "Async/await syntax",
      "Error handling with try/catch",
      "The event loop and task queue",
      "Microtasks vs macrotasks",
      "fetch() API basics",
      "Common async patterns",
    ],
    project_information:
      "Build a weather app that fetches data from a public API. Handle loading states, errors, and display weather information dynamically.",
    assessment_information:
      "Async/await exercises: convert callback-based code to promises and async/await. Debug asynchronous code issues.",
  },
  {
    day_number: 19,
    module_number: 2,
    week_number: 4,
    topic: "Error Handling & Debugging",
    content:
      "Master JavaScript error handling and debugging techniques. Learn to use browser developer tools, set breakpoints, and write robust error-handling code.",
    subtopics: [
      "Error types: Syntax, Reference, Type, Range",
      "Try/catch/finally blocks",
      "Custom error classes",
      "Error propagation and handling strategies",
      "Browser developer tools",
      "Console methods: log, warn, error, table",
      "Breakpoints and step debugging",
      "Network tab and API debugging",
      "Performance profiling",
      "Linting and code quality tools",
    ],
    project_information:
      "Add comprehensive error handling to the weather app. Implement custom error classes, retry logic, and user-friendly error messages.",
    assessment_information:
      "Debugging challenge: find and fix bugs in provided code. Error handling design exercise.",
  },
  {
    day_number: 20,
    module_number: 2,
    week_number: 5,
    topic: "ES6+ Modern JavaScript",
    content:
      "Explore modern JavaScript features: modules, classes, iterators, generators, symbols, and more. Understand how modern JavaScript has evolved.",
    subtopics: [
      "ES6 classes (syntax sugar over prototypes)",
      "Modules: import/export, default/named",
      "Template literals and tagged templates",
      "Iterators and for...of loops",
      "Generators (function*)",
      "Symbols and well-known symbols",
      "WeakMap and WeakSet",
      "Proxy and Reflect",
      "Shared memory and atomics (overview)",
      "JavaScript engines and JIT compilation",
    ],
    project_information:
      "Refactor the todo app to use ES6 modules. Split code into separate files: app.js, todo.js, storage.js, ui.js.",
    assessment_information:
      "ES6+ feature identification exercise. Module system quiz: import/export patterns and best practices.",
  },
  {
    day_number: 21,
    module_number: 2,
    week_number: 5,
    topic: "Working with APIs",
    content:
      "Learn to consume REST APIs using fetch. Understand HTTP methods, status codes, headers, and request/response patterns. Handle CORS and authentication.",
    subtopics: [
      "REST API concepts",
      "HTTP methods: GET, POST, PUT, DELETE",
      "Status codes and their meanings",
      "Request and response headers",
      "JSON parsing and serialization",
      "fetch() method in depth",
      "POST requests with body",
      "CORS and same-origin policy",
      "API authentication: Bearer tokens",
      "Rate limiting and pagination",
    ],
    project_information:
      "Build a GitHub user search app that queries the GitHub API. Display user profiles, repositories, and followers.",
    assessment_information:
      "API consumption exercises: build a data dashboard using multiple API endpoints. HTTP methods quiz.",
  },
  {
    day_number: 22,
    module_number: 2,
    week_number: 5,
    topic: "Local Storage & Data Persistence",
    content:
      "Learn browser storage solutions: localStorage, sessionStorage, and IndexedDB. Understand when to use each and implement data persistence in web applications.",
    subtopics: [
      "localStorage API",
      "sessionStorage API",
      "Storing and retrieving JSON data",
      "Storage limits and quotas",
      "IndexedDB concepts",
      "IndexedDB CRUD operations",
      "Service workers and caching",
      "Cache API",
      "Offline-first strategies",
      "Data serialization patterns",
    ],
    project_information:
      "Enhance the todo app with IndexedDB storage. Add offline support and data export/import functionality.",
    assessment_information:
      "Storage comparison exercise: choose the right storage for different scenarios. IndexedDB CRUD implementation test.",
  },
  {
    day_number: 23,
    module_number: 2,
    week_number: 5,
    topic: "Web Accessibility & Performance",
    content:
      "Build accessible and performant web applications. Learn ARIA attributes, keyboard navigation, screen reader compatibility, and performance optimization techniques.",
    subtopics: [
      "WCAG guidelines",
      "Semantic HTML for accessibility",
      "ARIA roles, states, and properties",
      "Keyboard navigation and focus management",
      "Screen reader testing",
      "Color contrast and visual accessibility",
      "Performance metrics: FCP, LCP, CLS, FID",
      "Image optimization",
      "Lazy loading",
      "Code splitting concepts",
    ],
    project_information:
      "Audit the portfolio site for accessibility issues. Fix all WCAG AA violations. Optimize performance scores to 90+ on Lighthouse.",
    assessment_information:
      "Accessibility audit exercise. Performance optimization challenge: improve Lighthouse scores.",
  },
  {
    day_number: 24,
    module_number: 2,
    week_number: 5,
    topic: "Frontend Project Planning & Architecture",
    content:
      "Learn to plan and architect frontend projects. Understand component-based architecture, state management patterns, and project structure conventions.",
    subtopics: [
      "Project planning and requirements",
      "Component-based architecture",
      "State management approaches",
      "Component communication patterns",
      "Project structure conventions",
      "CSS architecture: BEM, CSS Modules",
      "Build tools: Webpack, Vite concepts",
      "Package managers: npm vs yarn vs pnpm",
      "Version control workflow for teams",
      "Documentation and README writing",
    ],
    project_information:
      "Plan a multi-page website project. Create a wireframe, component tree, data flow diagram, and project structure.",
    assessment_information:
      "Architecture design exercise: plan a frontend project from requirements. Component hierarchy analysis.",
  },
  {
    day_number: 25,
    module_number: 2,
    week_number: 5,
    topic: "Frontend Integration & Module Review",
    content:
      "Integrate all frontend skills into a cohesive project. Build a complete multi-page website with HTML, CSS, and JavaScript. Review Module 2 concepts.",
    subtopics: [
      "Full-stack frontend project build",
      "HTML structure and semantics",
      "CSS layout and responsive design",
      "JavaScript interactivity",
      "API integration",
      "Error handling and loading states",
      "Code organization and cleanup",
      "Cross-browser testing",
      "Module 2 comprehensive review",
    ],
    project_information:
      "Build a complete personal portfolio website with multiple pages, responsive design, API integration, and interactive features.",
    assessment_information:
      "Module 2 final assessment: build a complete frontend project from scratch within time constraints.",
  },
];

// ─── Module 3: React & Next.js (Days 26–50) ────────────────────────────────

const module3Days: DayData[] = [
  {
    day_number: 26,
    module_number: 3,
    week_number: 6,
    topic: "React Introduction & JSX",
    content:
      "Introduction to React and its component-based architecture. Learn JSX syntax, how React renders UI, and create your first React components.",
    subtopics: [
      "What is React and why use it",
      "Creating a React project with Vite",
      "JSX syntax and expressions",
      "Components: function components",
      "Rendering elements to the DOM",
      "Component tree and composition",
      "React Developer Tools",
      "StrictMode and development features",
    ],
    project_information:
      "Set up a React project with Vite. Create a component hierarchy for a profile card application.",
    assessment_information:
      "React concepts quiz. Create components from given designs.",
  },
  {
    day_number: 27,
    module_number: 3,
    week_number: 6,
    topic: "Props & Component Communication",
    content:
      "Master React props for passing data between components. Learn about prop types, default values, children prop, and component composition patterns.",
    subtopics: [
      "Props and their usage",
      "Passing data with props",
      "Children prop and composition",
      "Default props and destructuring",
      "PropTypes validation",
      "Component composition patterns",
      "Render props pattern",
      "Higher-order components concept",
    ],
    project_information:
      "Build a user profile system with reusable components. Create Avatar, UserInfo, and UserCard components that communicate via props.",
    assessment_information:
      "Props exercises: build component hierarchies with proper data flow. Identify prop drilling problems.",
  },
  {
    day_number: 28,
    module_number: 3,
    week_number: 6,
    topic: "State & useState Hook",
    content:
      "Learn React state management with the useState hook. Understand immutability, re-rendering, and how state drives UI updates.",
    subtopics: [
      "What is state in React",
      "useState hook syntax",
      "State updates and re-rendering",
      "Immutable state patterns",
      "State with arrays and objects",
      "Lazy initialization",
      "State lifting",
      "Derived state vs managed state",
    ],
    project_information:
      "Build an interactive counter app with multiple counters, reset functionality, and counter history. Demonstrate state lifting.",
    assessment_information:
      "State management exercises. Debug common state-related issues (mutating state, stale closures).",
  },
  {
    day_number: 29,
    module_number: 3,
    week_number: 6,
    topic: "useEffect & Side Effects",
    content:
      "Master the useEffect hook for handling side effects. Learn about the dependency array, cleanup functions, and common patterns.",
    subtopics: [
      "What are side effects",
      "useEffect syntax and behavior",
      "Dependency array rules",
      "Cleanup functions",
      "Fetching data with useEffect",
      "Event listeners in useEffect",
      "Timer and interval patterns",
      "Common useEffect mistakes",
      "useEffect vs event handlers",
    ],
    project_information:
      "Build a data fetching component that loads users from an API, handles loading/error states, and cleans up on unmount.",
    assessment_information:
      "useEffect exercises: implement various side effects. Debug dependency array issues.",
  },
  {
    day_number: 30,
    module_number: 3,
    week_number: 6,
    topic: "Forms & Event Handling in React",
    content:
      "Build controlled and uncontrolled forms in React. Handle form submission, validation, and complex form state management.",
    subtopics: [
      "Controlled vs uncontrolled inputs",
      "Handling text, select, checkbox, radio",
      "Form submission handling",
      "Form validation patterns",
      "Multi-step forms",
      "Dynamic form fields",
      "useRef for uncontrolled inputs",
      "Form libraries overview (React Hook Form)",
    ],
    project_information:
      "Build a multi-step registration form with validation, error messages, and form state persistence.",
    assessment_information:
      "Form building exercises with various input types. Validation implementation challenge.",
  },
  {
    day_number: 31,
    module_number: 3,
    week_number: 7,
    topic: "useRef, useMemo & useCallback",
    content:
      "Learn advanced React hooks: useRef for DOM access and mutable values, useMemo for memoized computations, and useCallback for memoized functions.",
    subtopics: [
      "useRef for DOM element access",
      "useRef for mutable values",
      "useMemo for expensive computations",
      "useCallback for stable function references",
      "When to use each hook",
      "Performance implications",
      "Memo vs useMemo",
      "Custom hook patterns",
    ],
    project_information:
      "Build a searchable data table with memoized filtering and sorting. Use useRef for focus management.",
    assessment_information:
      "Hooks usage decisions: identify when to use useRef, useMemo, useCallback. Performance optimization exercises.",
  },
  {
    day_number: 32,
    module_number: 3,
    week_number: 7,
    topic: "Custom Hooks",
    content:
      "Create reusable custom hooks to extract component logic. Learn patterns for data fetching, form handling, and state management.",
    subtopics: [
      "What are custom hooks",
      "Naming convention (use prefix)",
      "Extracting stateful logic",
      "useFetch custom hook",
      "useLocalStorage custom hook",
      "useDebounce custom hook",
      "useMediaQuery custom hook",
      "Composing custom hooks",
      "Testing custom hooks",
    ],
    project_information:
      "Create a library of 5 custom hooks: useFetch, useLocalStorage, useDebounce, useMediaQuery, useToggle. Use them in a demo app.",
    assessment_information:
      "Build custom hooks from given requirements. Identify logic that can be extracted into custom hooks.",
  },
  {
    day_number: 33,
    module_number: 3,
    week_number: 7,
    topic: "React Router",
    content:
      "Implement client-side routing with React Router. Learn about routes, navigation, dynamic segments, nested routes, and route guards.",
    subtopics: [
      "React Router v6 concepts",
      "BrowserRouter and Routes",
      "Route and Link components",
      "Dynamic route parameters",
      "useParams, useNavigate, useLocation",
      "Nested routes and Outlet",
      "Layout routes",
      "Protected routes pattern",
      "404 and catch-all routes",
      "Programmatic navigation",
    ],
    project_information:
      "Build a multi-page application with React Router. Include nested layouts, dynamic routes, and protected routes.",
    assessment_information:
      "Routing exercises: implement navigation, dynamic routes, and route guards. Debug routing issues.",
  },
  {
    day_number: 34,
    module_number: 3,
    week_number: 7,
    topic: "Context API & State Management",
    content:
      "Learn the Context API for global state management. Understand when to use Context vs local state, and implement themes, auth, and language providers.",
    subtopics: [
      "Prop drilling problem",
      "createContext and useContext",
      "Provider pattern",
      "Context vs Redux comparison",
      "Theme context implementation",
      "Auth context implementation",
      "Performance with Context",
      "Splitting contexts for performance",
      "useReducer with Context",
    ],
    project_information:
      "Build a theme switcher (light/dark) using Context API. Add an auth context for managing user sessions.",
    assessment_information:
      "Context API exercises: implement global state for different scenarios. Identify performance issues with Context.",
  },
  {
    day_number: 35,
    module_number: 3,
    week_number: 8,
    topic: "Next.js Introduction & App Router",
    content:
      "Introduction to Next.js and its App Router. Understand file-based routing, layouts, page components, and the Next.js project structure.",
    subtopics: [
      "What is Next.js and why use it",
      "Creating a Next.js project",
      "App Router vs Pages Router",
      "File-based routing conventions",
      "page.tsx, layout.tsx, loading.tsx",
      "error.tsx and not-found.tsx",
      "Route groups and layouts",
      "Metadata API",
      "Next.js project structure",
    ],
    project_information:
      "Set up a Next.js project with App Router. Create a multi-page layout with shared navigation.",
    assessment_information:
      "Next.js concepts quiz. Create pages and layouts from given requirements.",
  },
  {
    day_number: 36,
    module_number: 3,
    week_number: 8,
    topic: "Server Components & Client Components",
    content:
      "Understand the difference between Server Components and Client Components in Next.js. Learn when to use each and how they interact.",
    subtopics: [
      "Server Components by default",
      "use client directive",
      "When to use Client Components",
      "Server vs Client component patterns",
      "Passing props between server and client",
      "Server Components benefits (SEO, performance)",
      "Client Components for interactivity",
      "Composition patterns",
      "Third-party libraries and use client",
    ],
    project_information:
      "Convert a React app to Next.js, properly splitting components into server and client components.",
    assessment_information:
      "Component type decisions: identify which components should be server vs client. Refactoring exercise.",
  },
  {
    day_number: 37,
    module_number: 3,
    week_number: 8,
    topic: "Data Fetching in Next.js",
    content:
      "Learn data fetching patterns in Next.js App Router. Use server components for direct database queries, fetch with caching, and streaming.",
    subtopics: [
      "fetch() in server components",
      "Caching and revalidation",
      "Dynamic vs static data",
      "Parallel data fetching",
      "Loading UI with Suspense",
      "Streaming and progressive rendering",
      "Server Actions for mutations",
      "Error boundaries for data fetching",
    ],
    project_information:
      "Build a data dashboard that fetches from multiple API sources with loading states and error handling.",
    assessment_information:
      "Data fetching pattern exercises. Implement caching and revalidation strategies.",
  },
  {
    day_number: 38,
    module_number: 3,
    week_number: 8,
    topic: "API Routes & Route Handlers",
    content:
      "Create API endpoints in Next.js using Route Handlers. Build REST APIs with proper HTTP methods, request/response handling, and validation.",
    subtopics: [
      "route.ts file convention",
      "GET, POST, PUT, DELETE handlers",
      "Request and Response objects",
      "Query parameters and body parsing",
      "Status codes and headers",
      "Middleware for API routes",
      "API route validation",
      "Error handling in API routes",
      "External API integration",
    ],
    project_information:
      "Build a REST API for a blog application with CRUD operations for posts and comments.",
    assessment_information:
      "API design exercises. Implement a complete REST API with validation and error handling.",
  },
  {
    day_number: 39,
    module_number: 3,
    week_number: 8,
    topic: "Server Actions & Forms",
    content:
      "Learn Server Actions for form handling in Next.js. Understand the use server directive, progressive enhancement, and form validation.",
    subtopics: [
      "Server Actions concept",
      "use server directive",
      "Form actions with Server Actions",
      "Progressive enhancement",
      "useFormState and useFormStatus",
      "Server-side validation",
      "Optimistic updates",
      "Revalidating data after mutations",
      "File uploads with Server Actions",
    ],
    project_information:
      "Build a contact form using Server Actions with validation, success/error states, and revalidation.",
    assessment_information:
      "Server Actions exercises. Implement forms with progressive enhancement.",
  },
  {
    day_number: 40,
    module_number: 3,
    week_number: 9,
    topic: "Styling in Next.js",
    content:
      "Explore styling options in Next.js: Tailwind CSS, CSS Modules, styled-components, and global styles. Learn best practices for styling Next.js applications.",
    subtopics: [
      "Tailwind CSS setup and configuration",
      "CSS Modules in Next.js",
      "Global CSS and layout styles",
      "CSS-in-JS options",
      "Theming and design tokens",
      "Responsive design in Next.js",
      "Dark mode implementation",
      "Animation libraries",
    ],
    project_information:
      "Set up Tailwind CSS in the Next.js project. Create a design system with reusable components.",
    assessment_information:
      "Styling approach comparison exercise. Implement responsive components with Tailwind CSS.",
  },
  {
    day_number: 41,
    module_number: 3,
    week_number: 9,
    topic: "Authentication in Next.js",
    content:
      "Implement authentication in Next.js applications. Learn about session management, middleware for route protection, and integrating with Supabase Auth.",
    subtopics: [
      "Authentication vs authorization",
      "Session-based vs token-based auth",
      "Supabase Auth integration",
      "Middleware for route protection",
      "Server-side session validation",
      "Client-side auth state",
      "Protected API routes",
      "Auth flow implementation",
    ],
    project_information:
      "Implement complete authentication in the Next.js app: login, logout, signup, and protected routes.",
    assessment_information:
      "Auth flow design exercise. Implement middleware-based route protection.",
  },
  {
    day_number: 42,
    module_number: 3,
    week_number: 9,
    topic: "Database Integration",
    content:
      "Connect Next.js to databases. Learn about Prisma ORM, Supabase client, and database operations in server components and API routes.",
    subtopics: [
      "Database connection patterns",
      "Prisma setup and schema",
      "CRUD operations with Prisma",
      "Supabase client for database",
      "Server component data queries",
      "Database seeding",
      "Migration management",
      "Connection pooling",
    ],
    project_information:
      "Integrate a database with the Next.js app. Create, read, update, and delete records from server components.",
    assessment_information:
      "Database integration exercises. Implement CRUD operations with proper error handling.",
  },
  {
    day_number: 43,
    module_number: 3,
    week_number: 9,
    topic: "State Management Patterns",
    content:
      "Explore advanced state management in Next.js. Learn about URL state, server state, form state, and when to use different state management approaches.",
    subtopics: [
      "State management overview",
      "URL state with searchParams",
      "Server state vs client state",
      "Form state management",
      "Global state with Context",
      "State machines concept",
      "Zustand overview",
      "State persistence patterns",
    ],
    project_information:
      "Implement URL-based filtering and pagination in a data table. Manage complex form state across multiple pages.",
    assessment_information:
      "State management decisions: choose the right approach for different scenarios.",
  },
  {
    day_number: 44,
    module_number: 3,
    week_number: 9,
    topic: "Image & Font Optimization",
    content:
      "Optimize images and fonts in Next.js using the built-in Image and Font components. Learn about lazy loading, responsive images, and web fonts.",
    subtopics: [
      "next/image component",
      "Image formats and optimization",
      "Responsive images with sizes",
      "Lazy loading and priority",
      "next/font for Google Fonts",
      "Local font optimization",
      "Font display and loading strategies",
      "Performance impact of optimization",
    ],
    project_information:
      "Optimize all images and fonts in the project. Implement responsive images and proper font loading.",
    assessment_information:
      "Image optimization exercise. Font loading strategy implementation.",
  },
  {
    day_number: 45,
    module_number: 3,
    week_number: 10,
    topic: "Caching & Performance",
    content:
      "Master caching strategies in Next.js. Learn about static generation, incremental static regeneration, and performance optimization techniques.",
    subtopics: [
      "Caching strategies overview",
      "Static Site Generation (SSG)",
      "Incremental Static Regeneration (ISR)",
      "Dynamic rendering",
      "Cache invalidation",
      "Performance monitoring",
      "Core Web Vitals optimization",
      "Bundle analysis",
      "Code splitting in Next.js",
    ],
    project_information:
      "Implement different caching strategies for different pages. Optimize performance scores to 90+.",
    assessment_information:
      "Caching strategy decisions. Performance optimization challenge.",
  },
  {
    day_number: 46,
    module_number: 3,
    week_number: 10,
    topic: "Testing React & Next.js",
    content:
      "Write tests for React and Next.js applications. Learn unit testing with Vitest, component testing, and testing patterns.",
    subtopics: [
      "Testing pyramid concept",
      "Vitest setup and configuration",
      "Unit testing functions and hooks",
      "Component testing with React Testing Library",
      "Testing user interactions",
      "Mocking API calls",
      "Testing Next.js pages",
      "Snapshot testing",
      "Test coverage reporting",
    ],
    project_information:
      "Write unit and component tests for the existing Next.js application. Achieve 80%+ test coverage.",
    assessment_information:
      "Testing exercises: write tests for given components and functions. Test coverage analysis.",
  },
  {
    day_number: 47,
    module_number: 3,
    week_number: 10,
    topic: "Deployment & Production",
    content:
      "Deploy Next.js applications to production. Learn about Vercel deployment, environment variables, build optimization, and monitoring.",
    subtopics: [
      "Vercel deployment",
      "Environment variable management",
      "Build optimization",
      "Production configuration",
      "Domain and SSL setup",
      "Analytics and monitoring",
      "Error tracking (Sentry)",
      "Performance monitoring",
      "SEO optimization",
    ],
    project_information:
      "Deploy the Next.js application to Vercel. Configure environment variables and verify production behavior.",
    assessment_information:
      "Deployment checklist exercise. Production configuration review.",
  },
  {
    day_number: 48,
    module_number: 3,
    week_number: 10,
    topic: "Advanced Patterns & Best Practices",
    content:
      "Learn advanced React and Next.js patterns: compound components, render props, HOCs, and best practices for scalable applications.",
    subtopics: [
      "Compound component pattern",
      "Render props pattern",
      "Higher-order components",
      "Custom hooks patterns",
      "Code organization strategies",
      "Performance patterns",
      "Accessibility patterns",
      "Error boundary patterns",
      "Logging and monitoring patterns",
    ],
    project_information:
      "Implement advanced patterns in existing components. Refactor code to follow best practices.",
    assessment_information:
      "Pattern identification exercise. Refactoring challenge using advanced patterns.",
  },
  {
    day_number: 49,
    module_number: 3,
    week_number: 10,
    topic: "Portfolio Project Planning",
    content:
      "Plan and architect a portfolio project that demonstrates all frontend skills learned. Create wireframes, component trees, and implementation plans.",
    subtopics: [
      "Project requirements analysis",
      "Feature prioritization",
      "Wireframing and prototyping",
      "Component architecture design",
      "Database schema design",
      "API design",
      "Implementation timeline",
      "Risk assessment",
    ],
    project_information:
      "Create a complete project plan for a full-stack application. Include wireframes, tech stack decisions, and implementation roadmap.",
    assessment_information:
      "Project plan review and critique. Architecture decision documentation.",
  },
  {
    day_number: 50,
    module_number: 3,
    week_number: 10,
    topic: "Module 3 Review & Assessment",
    content:
      "Comprehensive review of React and Next.js concepts. Solve challenges and build a mini-project demonstrating all skills learned in Module 3.",
    subtopics: [
      "React hooks review",
      "Next.js App Router review",
      "Server vs Client components review",
      "Data fetching patterns review",
      "Authentication review",
      "State management review",
      "Testing strategies review",
      "Module 3 comprehensive assessment",
    ],
    project_information:
      "Build a mini-project from scratch: a multi-page app with authentication, data fetching, and responsive design.",
    assessment_information:
      "Module 3 final assessment: coding challenges, architecture design, and mini-project build.",
  },
];

// ─── Module 4: Backend Track (Days 51–75) ──────────────────────────────────

const module4Days: DayData[] = [
  {
    day_number: 51,
    module_number: 4,
    week_number: 11,
    topic: "Node.js Fundamentals",
    content:
      "Introduction to Node.js and server-side JavaScript. Learn about the Node.js runtime, modules, file system operations, and the event-driven architecture.",
    subtopics: [
      "What is Node.js",
      "Node.js vs browser JavaScript",
      "CommonJS and ES Modules",
      "fs module: reading and writing files",
      "path module for file paths",
      "Event loop in Node.js",
      "Process and environment variables",
      "npm and package management",
      "Global objects and utilities",
    ],
    project_information:
      "Build a CLI tool that reads a CSV file, processes the data, and outputs a summary report.",
    assessment_information:
      "Node.js fundamentals quiz. File system operations exercises.",
  },
  {
    day_number: 52,
    module_number: 4,
    week_number: 11,
    topic: "Express.js Introduction",
    content:
      "Build web servers with Express.js. Learn routing, middleware, request/response objects, and error handling in Express applications.",
    subtopics: [
      "What is Express.js",
      "Creating an Express server",
      "Route handlers: GET, POST, PUT, DELETE",
      "Route parameters and query strings",
      "Middleware concept and execution",
      "Built-in middleware: json, urlencoded",
      "Error handling middleware",
      "Response methods: json, send, status",
      "Router for modular routes",
    ],
    project_information:
      "Build a REST API for a book collection with CRUD operations, error handling, and proper status codes.",
    assessment_information:
      "Express.js routing exercises. Middleware implementation challenges.",
  },
  {
    day_number: 53,
    module_number: 4,
    week_number: 11,
    topic: "REST API Design Principles",
    content:
      "Learn RESTful API design principles and best practices. Understand resource naming, HTTP methods, status codes, and API versioning.",
    subtopics: [
      "REST architectural style",
      "Resource naming conventions",
      "HTTP methods and semantics",
      "Status code usage guide",
      "Request and response formatting",
      "Pagination patterns",
      "Filtering and sorting",
      "API versioning strategies",
      "HATEOAS concept",
      "OpenAPI/Swagger documentation",
    ],
    project_information:
      "Design and document a REST API for a task management application. Create an OpenAPI specification.",
    assessment_information:
      "API design review: evaluate and improve given API designs. REST principles quiz.",
  },
  {
    day_number: 54,
    module_number: 4,
    week_number: 11,
    topic: "Middleware & Error Handling",
    content:
      "Master Express middleware for authentication, validation, logging, and error handling. Build robust middleware pipelines.",
    subtopics: [
      "Custom middleware creation",
      "Authentication middleware (JWT)",
      "Validation middleware (Joi/Zod)",
      "Logging middleware",
      "CORS middleware",
      "Rate limiting middleware",
      "Request ID middleware",
      "Global error handling",
      "Async error handling",
      "Error response formatting",
    ],
    project_information:
      "Build a middleware library for an Express API: auth, validation, logging, rate limiting, and error handling.",
    assessment_information:
      "Middleware design exercises. Error handling pattern implementation.",
  },
  {
    day_number: 55,
    module_number: 4,
    week_number: 11,
    topic: "Authentication & Authorization",
    content:
      "Implement secure authentication and authorization. Learn about JWT tokens, password hashing, role-based access control, and session management.",
    subtopics: [
      "Authentication vs authorization",
      "Password hashing with bcrypt",
      "JWT token creation and verification",
      "Access tokens and refresh tokens",
      "Role-based access control (RBAC)",
      "Session management",
      "OAuth 2.0 concepts",
      "Security best practices",
      "Token refresh strategies",
      "Logout and token invalidation",
    ],
    project_information:
      "Implement complete authentication in the Express API: signup, login, token refresh, and role-based access.",
    assessment_information:
      "Auth flow implementation. Security review of authentication code.",
  },
  {
    day_number: 56,
    module_number: 4,
    week_number: 12,
    topic: "Python Web Development Introduction",
    content:
      "Introduction to Python web frameworks. Learn about Flask and FastAPI, routing, templates, and building web applications with Python.",
    subtopics: [
      "Python web frameworks overview",
      "Flask: routing, templates, forms",
      "FastAPI: routing, Pydantic models",
      "Request/response handling",
      "Template engines: Jinja2",
      "Static file serving",
      "Form handling",
      "Session management",
      "REST API with FastAPI",
    ],
    project_information:
      "Build a simple blog application with Flask. Include routes for listing, creating, and viewing posts.",
    assessment_information:
      "Flask/FastAPI comparison exercise. Build a REST API endpoint with FastAPI.",
  },
  {
    day_number: 57,
    module_number: 4,
    week_number: 12,
    topic: "FastAPI & Async Python",
    content:
      "Deep dive into FastAPI for building modern APIs. Learn async programming, dependency injection, validation, and automatic documentation.",
    subtopics: [
      "FastAPI setup and project structure",
      "Path parameters and query parameters",
      "Pydantic models for validation",
      "Dependency injection system",
      "Async route handlers",
      "Background tasks",
      "Automatic OpenAPI documentation",
      "CORS configuration",
      "Error handling in FastAPI",
    ],
    project_information:
      "Build a REST API with FastAPI including auto-generated documentation, validation, and error handling.",
    assessment_information:
      "FastAPI implementation exercises. API documentation review.",
  },
  {
    day_number: 58,
    module_number: 4,
    week_number: 12,
    topic: "API Security",
    content:
      "Secure APIs against common vulnerabilities. Learn about input validation, SQL injection prevention, XSS, CSRF, and rate limiting.",
    subtopics: [
      "OWASP Top 10 overview",
      "Input validation and sanitization",
      "SQL injection prevention",
      "XSS prevention",
      "CSRF protection",
      "Rate limiting implementation",
      "API key management",
      "CORS configuration",
      "Security headers",
      "Dependency vulnerability scanning",
    ],
    project_information:
      "Audit and secure an existing API. Implement input validation, rate limiting, and security headers.",
    assessment_information:
      "Security audit exercise. Implement security measures for common vulnerabilities.",
  },
  {
    day_number: 59,
    module_number: 4,
    week_number: 12,
    topic: "WebSockets & Real-time Communication",
    content:
      "Implement real-time features with WebSockets. Learn about WebSocket protocol, Socket.io, and building real-time applications.",
    subtopics: [
      "HTTP vs WebSocket",
      "WebSocket protocol basics",
      "Socket.io setup and events",
      "Broadcasting messages",
      "Rooms and namespaces",
      "Connection management",
      "Error handling in WebSockets",
      "Real-time notifications",
      "Chat application patterns",
    ],
    project_information:
      "Build a real-time chat application with Socket.io. Support multiple rooms and user presence.",
    assessment_information:
      "WebSocket implementation exercises. Real-time feature design.",
  },
  {
    day_number: 60,
    module_number: 4,
    week_number: 12,
    topic: "File Upload & Storage",
    content:
      "Handle file uploads in web applications. Learn about multipart form data, file validation, storage solutions, and image processing.",
    subtopics: [
      "Multipart form data",
      "Multer for Express file uploads",
      "File validation and sanitization",
      "Local file storage",
      "Cloud storage: S3, Supabase Storage",
      "Image processing with Sharp",
      "Thumbnail generation",
      "File streaming for large files",
      "Storage cost optimization",
    ],
    project_information:
      "Implement file upload functionality with validation, storage, and image processing.",
    assessment_information:
      "File upload implementation exercise. Storage strategy design.",
  },
  {
    day_number: 61,
    module_number: 4,
    week_number: 13,
    topic: "Background Jobs & Task Queues",
    content:
      "Process tasks asynchronously with background jobs. Learn about job queues, workers, and scheduling with tools like BullMQ and cron.",
    subtopics: [
      "Why background jobs matter",
      "Job queue concepts",
      "BullMQ setup and configuration",
      "Job types: immediate, delayed, recurring",
      "Worker processes",
      "Job retry and error handling",
      "Cron jobs and scheduling",
      "Email sending in background",
      "Data processing pipelines",
    ],
    project_information:
      "Implement a job queue for sending emails and processing data in the background.",
    assessment_information:
      "Background job design exercise. Implement retry logic and error handling.",
  },
  {
    day_number: 62,
    module_number: 4,
    week_number: 13,
    topic: "Email & Notification Systems",
    content:
      "Build email and notification systems. Learn about email templates, transactional emails, push notifications, and notification preferences.",
    subtopics: [
      "Email protocols: SMTP, IMAP",
      "Email services: SendGrid, Resend",
      "Email templates and layouts",
      "Transactional emails",
      "Push notifications (web)",
      "In-app notifications",
      "Notification preferences",
      "Email validation and deliverability",
      "Testing email systems",
    ],
    project_information:
      "Implement an email notification system with templates and user preferences.",
    assessment_information:
      "Email template design. Notification system architecture.",
  },
  {
    day_number: 63,
    module_number: 4,
    week_number: 13,
    topic: "API Integration & External Services",
    content:
      "Integrate third-party APIs and services. Learn about API clients, webhooks, rate limiting, and building reliable integrations.",
    subtopics: [
      "API client design patterns",
      "Axios vs fetch",
      "Webhook implementation",
      "Webhook verification",
      "API rate limiting handling",
      "Retry strategies with exponential backoff",
      "Circuit breaker pattern",
      "API monitoring and logging",
      "Third-party service integration",
    ],
    project_information:
      "Integrate a third-party API (payment, email, or social) with proper error handling and retry logic.",
    assessment_information:
      "API integration exercise. Implement webhook handling with verification.",
  },
  {
    day_number: 64,
    module_number: 4,
    week_number: 13,
    topic: "Logging & Monitoring",
    content:
      "Implement comprehensive logging and monitoring. Learn about structured logging, log levels, monitoring tools, and observability.",
    subtopics: [
      "Structured logging concept",
      "Winston/Pino for Node.js",
      "Log levels and filtering",
      "Request logging middleware",
      "Error tracking with Sentry",
      "Application metrics",
      "Health check endpoints",
      "Uptime monitoring",
      "Log aggregation",
    ],
    project_information:
      "Implement structured logging and monitoring in the Express API. Add health checks and error tracking.",
    assessment_information:
      "Logging strategy design. Monitoring dashboard implementation.",
  },
  {
    day_number: 65,
    module_number: 4,
    week_number: 13,
    topic: "Backend Project Architecture",
    content:
      "Design scalable backend architectures. Learn about layering, separation of concerns, dependency injection, and clean architecture.",
    subtopics: [
      "Layered architecture",
      "Clean architecture concept",
      "Repository pattern",
      "Service layer pattern",
      "Controller pattern",
      "Dependency injection",
      "Configuration management",
      "Environment-based configuration",
      "Project structure best practices",
    ],
    project_information:
      "Refactor the Express API to follow clean architecture principles. Separate concerns into layers.",
    assessment_information:
      "Architecture review exercise. Design a scalable backend structure.",
  },
  {
    day_number: 66,
    module_number: 4,
    week_number: 14,
    topic: "Python Advanced Backend",
    content:
      "Advanced Python backend development. Learn about async Python, connection pooling, caching with Redis, and performance optimization.",
    subtopics: [
      "Async Python with asyncio",
      "Async HTTP clients",
      "Connection pooling",
      "Redis caching",
      "Cache invalidation strategies",
      "Python performance profiling",
      "Memory management",
      "Garbage collection",
    ],
    project_information:
      "Build a high-performance Python API with async handlers, Redis caching, and connection pooling.",
    assessment_information:
      "Performance optimization exercises. Caching strategy implementation.",
  },
  {
    day_number: 67,
    module_number: 4,
    week_number: 14,
    topic: "GraphQL Introduction",
    content:
      "Introduction to GraphQL as an alternative to REST. Learn about schemas, queries, mutations, resolvers, and building GraphQL APIs.",
    subtopics: [
      "GraphQL vs REST",
      "Schema definition language",
      "Queries and mutations",
      "Resolvers and data sources",
      "Nested queries and relationships",
      "Input types and validation",
      "Error handling in GraphQL",
      "Subscriptions concept",
      "Apollo Server setup",
    ],
    project_information:
      "Build a GraphQL API for a blog application with posts, comments, and users.",
    assessment_information:
      "GraphQL schema design exercise. Query optimization challenges.",
  },
  {
    day_number: 68,
    module_number: 4,
    week_number: 14,
    topic: "Microservices Concepts",
    content:
      "Learn microservices architecture principles. Understand service decomposition, communication patterns, and when to use microservices.",
    subtopics: [
      "Monolith vs microservices",
      "Service decomposition strategies",
      "Synchronous communication (HTTP/gRPC)",
      "Asynchronous communication (message queues)",
      "API gateway pattern",
      "Service discovery",
      "Distributed transactions",
      "Saga pattern",
      "Microservices testing",
    ],
    project_information:
      "Design a microservices architecture for an e-commerce application. Create service boundaries and communication diagrams.",
    assessment_information:
      "Architecture design exercise. Microservices vs monolith decision analysis.",
  },
  {
    day_number: 69,
    module_number: 4,
    week_number: 14,
    topic: "Message Queues & Event-Driven Architecture",
    content:
      "Implement event-driven systems with message queues. Learn about pub/sub patterns, event sourcing, and building reactive systems.",
    subtopics: [
      "Message queue concepts",
      "RabbitMQ vs Redis Pub/Sub",
      "Event-driven architecture",
      "Pub/sub pattern",
      "Event sourcing concept",
      "CQRS pattern",
      "Dead letter queues",
      "Message serialization",
      "Idempotent message handling",
    ],
    project_information:
      "Implement an event-driven notification system with message queues for email and push notifications.",
    assessment_information:
      "Event-driven design exercise. Message queue implementation.",
  },
  {
    day_number: 70,
    module_number: 4,
    week_number: 14,
    topic: "API Versioning & Documentation",
    content:
      "Version APIs effectively and create comprehensive documentation. Learn about versioning strategies, OpenAPI specification, and API documentation tools.",
    subtopics: [
      "API versioning strategies",
      "URL path versioning",
      "Header versioning",
      "OpenAPI 3.0 specification",
      "Swagger UI and ReDoc",
      "API documentation best practices",
      "Changelog management",
      "Breaking changes policy",
      "API deprecation strategy",
    ],
    project_information:
      "Version the existing API and generate OpenAPI documentation. Create an API changelog.",
    assessment_information:
      "API documentation review. Versioning strategy design.",
  },
  {
    day_number: 71,
    module_number: 4,
    week_number: 15,
    topic: "Caching Strategies",
    content:
      "Implement comprehensive caching strategies. Learn about CDN caching, application caching, database caching, and cache invalidation patterns.",
    subtopics: [
      "Caching layers overview",
      "CDN caching (Vercel, Cloudflare)",
      "Application-level caching (Redis)",
      "Database query caching",
      "HTTP caching headers",
      "Cache invalidation strategies",
      "Cache-aside pattern",
      "Write-through caching",
      "TTL and expiration",
    ],
    project_information:
      "Implement multi-layer caching in the application. Add Redis caching and HTTP cache headers.",
    assessment_information:
      "Caching strategy design. Cache invalidation implementation.",
  },
  {
    day_number: 72,
    module_number: 4,
    week_number: 15,
    topic: "Performance Optimization",
    content:
      "Optimize backend performance. Learn about profiling, bottleneck identification, database query optimization, and horizontal scaling.",
    subtopics: [
      "Performance profiling tools",
      "CPU and memory profiling",
      "Database query optimization",
      "N+1 query problem",
      "Connection pooling",
      "Load balancing concepts",
      "Horizontal scaling",
      "Caching for performance",
      "Async processing for performance",
      "Performance testing with k6",
    ],
    project_information:
      "Profile and optimize the API. Fix N+1 queries, add caching, and improve response times by 50%.",
    assessment_information:
      "Performance profiling exercise. Optimization implementation and benchmarking.",
  },
  {
    day_number: 73,
    module_number: 4,
    week_number: 15,
    topic: "Testing Backend Applications",
    content:
      "Write comprehensive backend tests. Learn about unit testing, integration testing, API testing, and test-driven development.",
    subtopics: [
      "Testing pyramid for backends",
      "Unit testing services and utilities",
      "Integration testing with databases",
      "API testing with supertest",
      "Test database setup and teardown",
      "Mocking external services",
      "TDD workflow",
      "Test coverage and reporting",
      "CI/CD test integration",
    ],
    project_information:
      "Write comprehensive tests for the backend API. Achieve 80%+ coverage with unit and integration tests.",
    assessment_information:
      "Test writing exercises. TDD implementation challenge.",
  },
  {
    day_number: 74,
    module_number: 4,
    week_number: 15,
    topic: "Backend Capstone Project",
    content:
      "Build a complete backend application incorporating all learned concepts. Design the architecture, implement the API, and add testing and documentation.",
    subtopics: [
      "Project architecture design",
      "Database schema implementation",
      "API route implementation",
      "Authentication and authorization",
      "Error handling and validation",
      "Testing implementation",
      "API documentation",
      "Performance optimization",
    ],
    project_information:
      "Build a complete backend API for a project management tool. Include auth, CRUD, real-time updates, and comprehensive tests.",
    assessment_information:
      "Backend capstone project review. Architecture, code quality, and test coverage assessment.",
  },
  {
    day_number: 75,
    module_number: 4,
    week_number: 15,
    topic: "Module 4 Review & Assessment",
    content:
      "Comprehensive review of backend development concepts. Solve challenges covering Node.js, Express, Python, API design, and security.",
    subtopics: [
      "Node.js and Express review",
      "Python web frameworks review",
      "API design principles review",
      "Authentication and security review",
      "Performance optimization review",
      "Testing strategies review",
      "Architecture patterns review",
      "Module 4 comprehensive assessment",
    ],
    project_information:
      "Solve backend coding challenges and architecture design problems. Review and refactor previous backend projects.",
    assessment_information:
      "Module 4 final assessment: coding challenges, API design, and architecture review.",
  },
];

// ─── Module 5: Databases (Days 76–85) ──────────────────────────────────────

const module5Days: DayData[] = [
  {
    day_number: 76,
    module_number: 5,
    week_number: 16,
    topic: "Database Fundamentals",
    content:
      "Introduction to database concepts. Learn about relational vs non-relational databases, ACID properties, data modeling, and choosing the right database.",
    subtopics: [
      "What is a database",
      "Relational vs non-relational databases",
      "ACID properties",
      "CAP theorem",
      "Data modeling concepts",
      "Entity-relationship diagrams",
      "Choosing the right database",
      "Database design principles",
    ],
    project_information:
      "Design an entity-relationship diagram for a library management system. Identify entities, relationships, and attributes.",
    assessment_information:
      "Database concepts quiz. ER diagram design exercise.",
  },
  {
    day_number: 77,
    module_number: 5,
    week_number: 16,
    topic: "PostgreSQL Fundamentals",
    content:
      "Get started with PostgreSQL. Install, configure, and learn basic SQL operations: creating databases, tables, and performing CRUD operations.",
    subtopics: [
      "PostgreSQL installation",
      "psql command line tool",
      "Creating databases and schemas",
      "CREATE TABLE statement",
      "Data types: SERIAL, VARCHAR, TEXT, INTEGER, BOOLEAN, TIMESTAMP",
      "INSERT, SELECT, UPDATE, DELETE",
      "WHERE clauses and conditions",
      "ORDER BY and LIMIT",
      "Aggregate functions: COUNT, SUM, AVG",
    ],
    project_information:
      "Set up a PostgreSQL database for a blog application. Create tables for users, posts, and comments with CRUD operations.",
    assessment_information:
      "SQL basics exercises. CRUD operations practice with real data.",
  },
  {
    day_number: 78,
    module_number: 5,
    week_number: 16,
    topic: "SQL Joins & Relationships",
    content:
      "Master SQL joins and table relationships. Learn about one-to-one, one-to-many, and many-to-many relationships with practical examples.",
    subtopics: [
      "INNER JOIN",
      "LEFT JOIN and RIGHT JOIN",
      "FULL OUTER JOIN",
      "CROSS JOIN",
      "Self joins",
      "One-to-one relationships",
      "One-to-many relationships",
      "Many-to-many with junction tables",
      "Foreign key constraints",
      "ON DELETE and ON UPDATE actions",
    ],
    project_information:
      "Design and implement a database schema for an e-commerce application with products, orders, customers, and categories.",
    assessment_information:
      "Join exercises with multiple tables. Relationship design challenges.",
  },
  {
    day_number: 79,
    module_number: 5,
    week_number: 16,
    topic: "Advanced SQL",
    content:
      "Master advanced SQL features: subqueries, window functions, CTEs, and query optimization. Write complex queries for real-world scenarios.",
    subtopics: [
      "Subqueries (scalar, row, table)",
      "Correlated subqueries",
      "Common Table Expressions (CTEs)",
      "Window functions: ROW_NUMBER, RANK",
      "Aggregate window functions",
      "CASE expressions",
      "UNION and INTERSECT",
      "Indexes and query optimization",
      "EXPLAIN and query plans",
    ],
    project_information:
      "Write complex SQL queries for a reporting dashboard. Use window functions, CTEs, and subqueries.",
    assessment_information:
      "Advanced SQL exercises. Query optimization analysis.",
  },
  {
    day_number: 80,
    module_number: 5,
    week_number: 17,
    topic: "Prisma ORM",
    content:
      "Learn Prisma ORM for type-safe database access. Set up Prisma schema, perform CRUD operations, and use Prisma Client in TypeScript.",
    subtopics: [
      "What is an ORM",
      "Prisma setup and configuration",
      "Prisma schema definition",
      "Data modeling in Prisma",
      "Prisma Client generation",
      "CRUD operations with Prisma",
      "Relations and includes",
      "Filtering and sorting",
      "Transactions",
      "Migrations",
    ],
    project_information:
      "Set up Prisma for an existing project. Migrate the schema and rewrite database queries using Prisma Client.",
    assessment_information:
      "Prisma schema design exercises. CRUD implementation with Prisma.",
  },
  {
    day_number: 81,
    module_number: 5,
    week_number: 17,
    topic: "Database Design Patterns",
    content:
      "Learn database design patterns and best practices. Understand normalization, denormalization, soft deletes, auditing, and common patterns.",
    subtopics: [
      "Normalization (1NF, 2NF, 3NF)",
      "Denormalization strategies",
      "Soft delete pattern",
      "Audit trail pattern",
      "Type discrimination pattern",
      "Entity-attribute-value pattern",
      "Tree structures in SQL",
      "Time series data patterns",
      "Database constraints best practices",
    ],
    project_information:
      "Apply design patterns to an existing schema. Implement soft deletes, audit trails, and proper normalization.",
    assessment_information:
      "Schema design review. Pattern application exercises.",
  },
  {
    day_number: 82,
    module_number: 5,
    week_number: 17,
    topic: "MongoDB Introduction",
    content:
      "Introduction to MongoDB and document databases. Learn about documents, collections, CRUD operations, and MongoDB Atlas.",
    subtopics: [
      "What is MongoDB",
      "Document model vs relational model",
      "MongoDB Atlas setup",
      "MongoDB shell (mongosh)",
      "Insert, find, update, delete operations",
      "Query operators: $eq, $gt, $in, $and",
      "Projection and field selection",
      "Indexing in MongoDB",
      "Aggregation pipeline basics",
    ],
    project_information:
      "Set up a MongoDB Atlas cluster and perform CRUD operations for a blog application.",
    assessment_information:
      "MongoDB CRUD exercises. Query operator practice.",
  },
  {
    day_number: 83,
    module_number: 5,
    week_number: 17,
    topic: "MongoDB Advanced Operations",
    content:
      "Master advanced MongoDB operations: aggregation pipelines, embedded documents, references, and data modeling patterns for documents.",
    subtopics: [
      "Aggregation pipeline stages",
      "$match, $group, $sort, $project",
      "$lookup for joins",
      "$unwind for array processing",
      "Embedded documents pattern",
      "Reference pattern",
      "Data modeling decisions",
      "Change streams",
      "MongoDB transactions",
    ],
    project_information:
      "Build an analytics dashboard using MongoDB aggregation pipelines. Process and transform data for reporting.",
    assessment_information:
      "Aggregation pipeline exercises. Data modeling pattern selection.",
  },
  {
    day_number: 84,
    module_number: 5,
    week_number: 17,
    topic: "ORM Comparison & Data Migration",
    content:
      "Compare ORMs and database tools. Learn about data migration strategies, schema versioning, and moving data between databases.",
    subtopics: [
      "Prisma vs TypeORM vs Sequelize",
      "Migration strategies",
      "Schema versioning",
      "Data migration scripts",
      "Database seeding strategies",
      "Backup and restore",
      "Cross-database migration",
      "Zero-downtime migrations",
    ],
    project_information:
      "Create a migration script that moves data from MongoDB to PostgreSQL. Compare ORM approaches.",
    assessment_information:
      "ORM comparison exercise. Migration strategy design.",
  },
  {
    day_number: 85,
    module_number: 5,
    week_number: 17,
    topic: "Module 5 Review & Assessment",
    content:
      "Comprehensive review of database concepts. Solve challenges covering SQL, NoSQL, ORMs, and database design.",
    subtopics: [
      "PostgreSQL review",
      "SQL joins and advanced queries review",
      "Prisma ORM review",
      "MongoDB review",
      "Database design patterns review",
      "Performance optimization review",
      "Module 5 comprehensive assessment",
    ],
    project_information:
      "Design and implement a complete database schema for a complex application. Include migrations, seeding, and tests.",
    assessment_information:
      "Module 5 final assessment: database design, SQL challenges, and ORM implementation.",
  },
];

// ─── Module 6: QA & Testing (Days 86–90) ───────────────────────────────────

const module6Days: DayData[] = [
  {
    day_number: 86,
    module_number: 6,
    week_number: 18,
    topic: "Testing Fundamentals",
    content:
      "Learn testing principles and methodology. Understand the testing pyramid, test types, and how to write effective tests.",
    subtopics: [
      "Why testing matters",
      "Testing pyramid: unit, integration, e2e",
      "Test-driven development (TDD)",
      "Behavior-driven development (BDD)",
      "Test cases and assertions",
      "Mocking and stubbing",
      "Test coverage metrics",
      "Testing best practices",
    ],
    project_information:
      "Set up a testing framework for an existing project. Write tests for 5 critical functions.",
    assessment_information:
      "Testing concepts quiz. Test case design exercise.",
  },
  {
    day_number: 87,
    module_number: 6,
    week_number: 18,
    topic: "Unit Testing",
    content:
      "Master unit testing with Vitest and Jest. Test functions, hooks, components, and utilities in isolation.",
    subtopics: [
      "Unit testing concepts",
      "Vitest setup and configuration",
      "Test syntax: describe, it, expect",
      "Assertion methods",
      "Testing async code",
      "Mocking modules and functions",
      "Testing custom hooks",
      "Testing utilities and helpers",
      "Parameterized tests",
    ],
    project_information:
      "Write unit tests for all utility functions and custom hooks in the project. Achieve 90%+ unit test coverage.",
    assessment_information:
      "Unit test writing exercises. Mock implementation challenges.",
  },
  {
    day_number: 88,
    module_number: 6,
    week_number: 18,
    topic: "Integration Testing",
    content:
      "Write integration tests that verify component interactions, API endpoints, and database operations working together.",
    subtopics: [
      "Integration testing concepts",
      "API testing with supertest",
      "Database integration testing",
      "Test database setup and teardown",
      "Testing middleware chains",
      "Testing component interactions",
      "Mocking external services",
      "Test fixtures and factories",
    ],
    project_information:
      "Write integration tests for API endpoints. Test database operations with a test database.",
    assessment_information:
      "Integration test design exercise. Test database management.",
  },
  {
    day_number: 89,
    module_number: 6,
    week_number: 18,
    topic: "End-to-End Testing",
    content:
      "Write end-to-end tests that simulate real user workflows. Learn Playwright for browser automation testing.",
    subtopics: [
      "E2E testing concepts",
      "Playwright setup",
      "Page navigation and selectors",
      "User interaction simulation",
      "Form testing",
      "API mocking in E2E tests",
      "Visual regression testing",
      "CI/CD test integration",
    ],
    project_information:
      "Write E2E tests for critical user flows: login, dashboard navigation, and form submission.",
    assessment_information:
      "E2E test implementation. User flow test design.",
  },
  {
    day_number: 90,
    module_number: 6,
    week_number: 18,
    topic: "Testing Strategy & Code Quality",
    content:
      "Develop a comprehensive testing strategy. Learn about code review, linting, static analysis, and maintaining code quality.",
    subtopics: [
      "Testing strategy design",
      "Code review best practices",
      "ESLint configuration",
      "Prettier for code formatting",
      "Static type analysis",
      "Pre-commit hooks",
      "CI/CD test automation",
      "Code quality metrics",
      "Technical debt management",
    ],
    project_information:
      "Create a testing strategy document for the project. Set up linting, formatting, and pre-commit hooks.",
    assessment_information:
      "Testing strategy review. Code quality assessment of existing codebase.",
  },
];

// ─── Module 7: DevOps & CI/CD (Days 91–100) ────────────────────────────────

const module7Days: DayData[] = [
  {
    day_number: 91,
    module_number: 7,
    week_number: 19,
    topic: "Linux Fundamentals",
    content:
      "Learn essential Linux commands and concepts for server management. Understand file permissions, process management, and shell scripting.",
    subtopics: [
      "Linux command line basics",
      "File system navigation",
      "File permissions and chmod",
      "Process management: ps, top, kill",
      "User management",
      "Package management: apt, yum",
      "Shell scripting basics",
      "Cron jobs and scheduling",
      "SSH and remote access",
    ],
    project_information:
      "Write shell scripts for common server tasks: backup, log rotation, and system monitoring.",
    assessment_information:
      "Linux command exercises. Shell scripting challenges.",
  },
  {
    day_number: 92,
    module_number: 7,
    week_number: 19,
    topic: "Docker Fundamentals",
    content:
      "Learn containerization with Docker. Understand images, containers, Dockerfiles, and Docker Compose for multi-container applications.",
    subtopics: [
      "What is containerization",
      "Docker concepts: images, containers",
      "Dockerfile instructions",
      "Building Docker images",
      "Running and managing containers",
      "Docker Compose for multi-container apps",
      "Volume mounting",
      "Network configuration",
      "Docker Hub and registries",
    ],
    project_information:
      "Containerize a Node.js application with Docker. Create a Docker Compose setup for the full application stack.",
    assessment_information:
      "Dockerfile creation exercise. Docker Compose configuration challenge.",
  },
  {
    day_number: 93,
    module_number: 7,
    week_number: 19,
    topic: "Docker for Development & Production",
    content:
      "Optimize Docker for both development and production environments. Learn about multi-stage builds, health checks, and production best practices.",
    subtopics: [
      "Development containers with hot reload",
      "Multi-stage Docker builds",
      "Docker health checks",
      "Environment variable management",
      "Docker security best practices",
      "Image optimization",
      "Layer caching strategies",
      "Docker in CI/CD pipelines",
    ],
    project_information:
      "Create optimized Docker configurations for development and production. Implement multi-stage builds.",
    assessment_information:
      "Docker optimization exercise. Security review of Docker configurations.",
  },
  {
    day_number: 94,
    module_number: 7,
    week_number: 19,
    topic: "CI/CD Concepts & GitHub Actions",
    content:
      "Learn continuous integration and deployment concepts. Set up GitHub Actions for automated testing, building, and deployment.",
    subtopics: [
      "CI/CD concepts and benefits",
      "GitHub Actions fundamentals",
      "Workflow syntax and structure",
      "Triggers and events",
      "Jobs and steps",
      "Secrets management",
      "Caching in workflows",
      "Matrix builds",
      "Reusable workflows",
    ],
    project_information:
      "Create a GitHub Actions workflow for the project: lint, test, build, and deploy on push to main.",
    assessment_information:
      "GitHub Actions workflow creation. CI/CD pipeline design exercise.",
  },
  {
    day_number: 95,
    module_number: 7,
    week_number: 19,
    topic: "Deployment Platforms",
    content:
      "Deploy applications to various platforms. Learn about Vercel, Railway, Fly.io, and traditional VPS deployment.",
    subtopics: [
      "Platform as a Service (PaaS)",
      "Vercel deployment for Next.js",
      "Railway deployment",
      "Fly.io deployment",
      "VPS deployment with Docker",
      "Nginx reverse proxy",
      "SSL/TLS certificate setup",
      "Domain configuration",
      "Environment management per platform",
    ],
    project_information:
      "Deploy the application to two different platforms. Compare the deployment processes and configurations.",
    assessment_information:
      "Deployment exercise on multiple platforms. Configuration comparison.",
  },
  {
    day_number: 96,
    module_number: 7,
    week_number: 20,
    topic: "Infrastructure as Code",
    content:
      "Learn infrastructure as code principles. Understand Terraform basics, configuration management, and automated infrastructure provisioning.",
    subtopics: [
      "Infrastructure as Code concepts",
      "Terraform basics: providers, resources",
      "Terraform state management",
      "Variables and outputs",
      "Modules and composition",
      "Ansible for configuration management",
      "Cloud infrastructure (AWS/GCP basics)",
      "Cost optimization",
    ],
    project_information:
      "Write Terraform configuration to provision basic cloud infrastructure: a VM, database, and networking.",
    assessment_information:
      "Terraform configuration exercise. Infrastructure design review.",
  },
  {
    day_number: 97,
    module_number: 7,
    week_number: 20,
    topic: "Monitoring & Observability",
    content:
      "Implement monitoring and observability for deployed applications. Learn about logging, metrics, tracing, and alerting.",
    subtopics: [
      "Three pillars of observability",
      "Centralized logging with cloud services",
      "Application metrics collection",
      "Distributed tracing concept",
      "Alerting and incident response",
      "Uptime monitoring",
      "Performance dashboards",
      "SLAs and SLOs",
    ],
    project_information:
      "Set up monitoring for the deployed application. Create dashboards and configure alerts.",
    assessment_information:
      "Monitoring strategy design. Dashboard creation exercise.",
  },
  {
    day_number: 98,
    module_number: 7,
    week_number: 20,
    topic: "Security in DevOps",
    content:
      "Integrate security into the DevOps pipeline. Learn about DevSecOps, vulnerability scanning, secrets management, and security best practices.",
    subtopics: [
      "DevSecOps principles",
      "Dependency vulnerability scanning",
      "Container security scanning",
      "Secrets management (Vault, env vars)",
      "SAST and DAST tools",
      "Security in CI/CD pipelines",
      "Network security basics",
      "Compliance and auditing",
    ],
    project_information:
      "Add security scanning to the CI/CD pipeline. Implement secrets management and vulnerability checks.",
    assessment_information:
      "Security integration exercise. Pipeline security review.",
  },
  {
    day_number: 99,
    module_number: 7,
    week_number: 20,
    topic: "DevOps Project",
    content:
      "Apply all DevOps concepts to a real project. Set up complete CI/CD pipeline, containerization, deployment, and monitoring.",
    subtopics: [
      "Complete DevOps pipeline setup",
      "Docker optimization",
      "CI/CD workflow implementation",
      "Multi-environment deployment",
      "Monitoring and alerting setup",
      "Incident response runbook",
      "Documentation and handover",
    ],
    project_information:
      "Set up a complete DevOps pipeline for the capstone project. Include testing, building, deploying, and monitoring.",
    assessment_information:
      "DevOps pipeline review. Documentation quality assessment.",
  },
  {
    day_number: 100,
    module_number: 7,
    week_number: 20,
    topic: "Module 7 Review & Assessment",
    content:
      "Comprehensive review of DevOps concepts. Solve challenges covering Docker, CI/CD, deployment, and monitoring.",
    subtopics: [
      "Linux and Docker review",
      "CI/CD concepts review",
      "GitHub Actions review",
      "Deployment strategies review",
      "Monitoring and observability review",
      "Security practices review",
      "Module 7 comprehensive assessment",
    ],
    project_information:
      "Review and optimize all DevOps configurations. Create comprehensive deployment documentation.",
    assessment_information:
      "Module 7 final assessment: DevOps challenges, pipeline design, and deployment exercise.",
  },
];

// ─── Module 8: Software Architecture & Design (Days 101–105) ───────────────

const module8Days: DayData[] = [
  {
    day_number: 101,
    module_number: 8,
    week_number: 21,
    topic: "Architectural Patterns",
    content:
      "Study software architectural patterns: MVC, MVVM, microservices, serverless, and event-driven architectures. Understand trade-offs and when to apply each.",
    subtopics: [
      "MVC pattern",
      "MVVM pattern",
      "Microservices architecture",
      "Serverless architecture",
      "Event-driven architecture",
      "Hexagonal architecture",
      "Clean architecture",
      "Trade-offs and decision criteria",
    ],
    project_information:
      "Analyze the architecture of 3 open-source projects. Document patterns used and design decisions.",
    assessment_information:
      "Architecture pattern identification. Trade-off analysis exercise.",
  },
  {
    day_number: 102,
    module_number: 8,
    week_number: 21,
    topic: "System Design",
    content:
      "Learn system design principles for scalable applications. Cover load balancing, caching, database sharding, and distributed systems concepts.",
    subtopics: [
      "System design interview approach",
      "Load balancing strategies",
      "Caching at scale",
      "Database sharding",
      "Message queues at scale",
      "CDN and edge computing",
      "Rate limiting at scale",
      "Cap theorem in practice",
    ],
    project_information:
      "Design a scalable system for a URL shortener. Document all components, data flow, and scaling strategies.",
    assessment_information:
      "System design exercise. Scalability analysis of existing systems.",
  },
  {
    day_number: 103,
    module_number: 8,
    week_number: 21,
    topic: "API Design & Documentation",
    content:
      "Design professional APIs with comprehensive documentation. Learn API design standards, versioning, and developer experience.",
    subtopics: [
      "API design standards",
      "RESTful API design principles",
      "GraphQL schema design",
      "API versioning strategies",
      "Error response design",
      "Pagination and filtering",
      "Rate limiting design",
      "Developer documentation",
      "SDK and client library design",
    ],
    project_information:
      "Design and document a complete API for a social media application. Create OpenAPI spec and developer guide.",
    assessment_information:
      "API design review. Documentation quality assessment.",
  },
  {
    day_number: 104,
    module_number: 8,
    week_number: 21,
    topic: "Portfolio & Professional Development",
    content:
      "Build a professional portfolio showcasing your skills. Learn about personal branding, technical writing, and career preparation.",
    subtopics: [
      "Portfolio website design",
      "Project presentation and case studies",
      "Technical blog writing",
      "GitHub profile optimization",
      "LinkedIn profile enhancement",
      "Resume and CV for developers",
      "Interview preparation",
      "Open source contribution",
      "Continuous learning strategies",
    ],
    project_information:
      "Create a portfolio website with project case studies. Write technical blog posts about your learning journey.",
    assessment_information:
      "Portfolio review and feedback. Technical writing exercise.",
  },
  {
    day_number: 105,
    module_number: 8,
    week_number: 21,
    topic: "Capstone Project & Celebration",
    content:
      "Complete the capstone project and reflect on the 105-day journey. Review all concepts learned, present the final project, and plan next steps.",
    subtopics: [
      "Capstone project completion",
      "Code review and refactoring",
      "Performance optimization",
      "Final testing and deployment",
      "Project presentation",
      "Journey reflection",
      "Skills inventory",
      "Next steps and learning path",
      "Community and networking",
    ],
    project_information:
      "Complete and deploy the capstone project. Present it with a live demo and technical documentation.",
    assessment_information:
      "Capstone project final assessment. Comprehensive portfolio review. 105-day journey reflection.",
  },
];

// ─── Export all days ────────────────────────────────────────────────────────

export const curriculumDays: DayData[] = [
  ...module1Days,
  ...module2Days,
  ...module3Days,
  ...module4Days,
  ...module5Days,
  ...module6Days,
  ...module7Days,
  ...module8Days,
];
