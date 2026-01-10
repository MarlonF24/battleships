# Battleships Web Game

A modern multiplayer battleships game built with React, TypeScript, Node.js, and WebSockets.

## 🎯 Learning Objectives

This project will help you develop:

- **Frontend**: React, TypeScript, CSS/Styled Components, HTML5 Canvas
- **Backend**: Node.js, Express, WebSockets (Socket.io)
- **Async Programming**: Promises, async/await, real-time communication
- **Game Development**: State management, game logic, multiplayer coordination
- **Modern Web Dev**: ES6+, bundling, development tools

## 🚀 Tech Stack

### Frontend

- **React 18** - Component-based UI library
- **TypeScript** - Type safety and better developer experience
- **Vite** - Fast build tool and dev server
- **CSS Modules/Styled Components** - Component styling
- **Socket.io Client** - Real-time communication

### Backend

- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **Socket.io** - Real-time bidirectional communication
- **TypeScript** - Shared types between frontend/backend

## 🎮 Game Features

### Phase 1 - Basic Game

- [x] Project setup
- [ ] Game board rendering
- [ ] Ship placement (drag & drop)
- [ ] Turn-based gameplay
- [ ] Hit/miss detection
- [ ] Win/lose conditions

### Phase 2 - Enhanced Features

- [ ] Real-time multiplayer
- [ ] Room creation and joining
- [ ] Player matching
- [ ] Game state synchronization
- [ ] Responsive design

### Phase 3 - Advanced Features

- [ ] Animations and sound effects
- [ ] Chat system
- [ ] Player statistics
- [ ] Different ship types and abilities
- [ ] Tournament mode

## 📚 Learning Path

### 1. Frontend Fundamentals (Week 1-2)

**HTML/CSS**:

- Semantic HTML structure
- CSS Grid and Flexbox for game board layout
- CSS animations for game effects
- Responsive design principles

**JavaScript/TypeScript**:

- ES6+ features (arrow functions, destructuring, modules)
- TypeScript basics (types, interfaces, generics)
- Async/await and Promises
- Array methods (map, filter, reduce)

### 2. React Development (Week 2-3)

- Component architecture and props
- State management with useState and useReducer
- Effect handling with useEffect
- Custom hooks for game logic
- Context API for global state

### 3. Backend Development (Week 3-4)

- Express server setup and routing
- RESTful API design
- WebSocket communication with Socket.io
- Real-time event handling
- Error handling and validation

### 4. Advanced Topics (Week 4-5)

- Real-time multiplayer architecture
- State synchronization strategies
- Performance optimization
- Testing strategies
- Deployment considerations

## 🔧 Development Setup

1. **Frontend Setup**:

   ```bash
   cd frontend
   npm create vite@latest . -- --template react-ts
   npm install socket.io-client styled-components
   ```

2. **Backend Setup**:

   ```bash
   cd backend
   npm init -y
   npm install express socket.io cors
   npm install -D @types/node @types/express nodemon typescript
   ```

## 🎲 Game Architecture

### Client-Side Architecture

```text
src/
├── components/          # Reusable UI components
│   ├── GameBoard/      # Game board display
│   ├── Ship/           # Ship components
│   └── PlayerPanel/    # Player info and controls
├── hooks/              # Custom React hooks
│   ├── useSocket.ts    # Socket connection logic
│   ├── useGameState.ts # Game state management
│   └── useShipPlacement.ts
├── types/              # TypeScript type definitions
├── utils/              # Helper functions
└── styles/             # Global styles
```

### Server-Side Architecture

```text
src/
├── models/             # Game models and types
├── services/           # Game logic services
├── socket/             # Socket.io event handlers
├── routes/             # HTTP API routes
└── utils/              # Shared utilities
```

## 🎯 Key Learning Concepts

### Async Programming Patterns

- **Event-driven architecture** with Socket.io
- **Promise chains** for API calls
- **Async state management** in React
- **Real-time updates** without blocking UI

### Game Development Concepts

- **State machines** for game pages
- **Collision detection** for ship placement
- **Turn management** in multiplayer games
- **Data synchronization** across clients

### Modern Web Development

- **Component composition** patterns
- **Type-safe API contracts**
- **Real-time communication protocols**
- **Responsive and accessible UI design**

## 🎨 Styling Approach

We'll use **CSS Modules** or **Styled Components** for:

- Component-scoped styling
- Dynamic styles based on game state
- Smooth animations for ship movement
- Responsive grid layouts
- Theme support (light/dark mode)

## 📖 Next Steps

1. Set up the development environment
2. Create a basic game board component
3. Implement ship placement mechanics
4. Add game logic and state management
5. Integrate WebSocket communication
6. Polish UI and add animations

Ready to start coding? Let's begin with setting up your development environment!
