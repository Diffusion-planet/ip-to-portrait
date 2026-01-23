# Web UI Troubleshooting Guide

## React Flow State Update Issues

### Problem: UI Controls Not Responding

**Symptoms:**
- Dropdown selections don't update
- Number steppers (count, steps, etc.) don't change values
- Toggles don't switch
- Image upload doesn't trigger
- All UI interactions appear frozen

**Root Cause:**

React Flow's `useNodesState` hook only uses the initial value passed to it. When state changes occur (e.g., params, count, parallel), the nodes array doesn't automatically update even though `initialNodes` is recalculated via `useMemo`.

```typescript
// INCORRECT - nodes won't update when state changes
const initialNodes = useMemo(() => [
  // ... nodes with data.params, data.count, etc.
], [params, count, ...])

const [nodes, , onNodesChange] = useNodesState(initialNodes)
// nodes stays at initial value, ignoring later changes to initialNodes
```

React Flow requires the nodes array reference to change for re-rendering, but `useNodesState` doesn't watch for changes in the initial value after first render.

**Solution:**

Use `setNodes` in a `useEffect` to update nodes whenever `initialNodes` changes:

```typescript
// CORRECT - nodes update when state changes
const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

// Update nodes when state changes
useEffect(() => {
  setNodes(initialNodes)
}, [initialNodes, setNodes])
```

**Flow:**
1. User changes dropdown/count/toggle
2. State updates (params/count/parallel)
3. `initialNodes` recalculates (useMemo dependency triggered)
4. `useEffect` fires and calls `setNodes(initialNodes)`
5. React Flow re-renders with updated node data
6. UI controls reflect new values

**Files Modified:**
- `/web/frontend/app/page.tsx` lines 573-578

**Related Issues:**
- React Flow documentation: https://reactflow.dev/error#002
- Always define nodeTypes/edgeTypes outside component or memoize them

---

## Node Module Cache Issues

### Problem: Module Not Found Errors After Uninstalling Package

**Symptoms:**
```
Error: ENOENT: no such file or directory, open 'node_modules/package-name/...'
```

**Root Cause:**

Next.js caches module resolutions in `.next` directory. After uninstalling packages, stale imports may remain in cache.

**Solution:**

Clean install:
```bash
cd web/frontend
rm -rf node_modules .next package-lock.json
npm install
```

**Prevention:**
- Clear cache after package changes
- Use `npm ci` for clean installs
- Restart dev server after dependency changes

---

## Port Already in Use

### Problem: EADDRINUSE Error

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3008
```

**Solution:**

Kill process on port:
```bash
lsof -ti:3008 | xargs kill -9
```

Or change port in `package.json`:
```json
{
  "scripts": {
    "dev": "next dev -p 3009"
  }
}
```

---

## Common Development Workflow

### After Making State Changes

1. Verify state flows through nodes:
   - Check `initialNodes` useMemo dependencies
   - Ensure `useEffect` updates nodes via `setNodes`

2. Test all affected UI controls:
   - Dropdowns
   - Number steppers
   - Toggles
   - Image uploads

3. Check browser console for errors:
   - React warnings
   - Network errors
   - State update issues

### After Installing/Uninstalling Packages

1. Clear caches:
   ```bash
   rm -rf .next node_modules
   npm install
   ```

2. Restart dev server

3. Hard refresh browser (Cmd+Shift+R)

---

## Best Practices

### React Flow Integration

1. Always memoize node/edge types outside component or with useMemo
2. Use `setNodes`/`setEdges` to update state, don't rely on initial values
3. Include all state dependencies in `initialNodes` useMemo
4. Add useEffect to sync nodes with state changes

### State Management

1. Keep node data in React state (not in nodes array directly)
2. Pass callbacks (onChange, onUpload, etc.) through node data
3. Update state first, let nodes sync via useEffect

### Debugging

1. Add console.logs in:
   - onChange callbacks
   - useEffect hooks
   - useMemo recalculations

2. Check React DevTools:
   - Component state
   - Props passed to nodes
   - Re-render frequency

3. Monitor network tab:
   - API calls
   - Upload requests
   - WebSocket connections
