<!--
  CanvasDatagrid.svelte - Svelte 5 wrapper for canvas-datagrid

  Usage:
    <script>
      import CanvasDatagrid from 'canvas-datagrid/svelte';

      let grid;
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      const schema = [
        { name: 'name', type: 'string', width: 200 },
        { name: 'age', type: 'number', width: 100 },
      ];
    </script>

    <CanvasDatagrid
      bind:this={grid}
      {data}
      {schema}
      editable
      style={{ cellHeight: 30 }}
      onclick={(e) => console.log('clicked', e)}
      onselectionchanged={(e) => console.log('selection', e)}
    />

    <!-- Escape-hatch access to raw grid instance -->
    <button onclick={() => grid.getGrid().fitColumnToValues('all')}>
      Fit Columns
    </button>

  Props:
    - data: Array of row objects
    - schema: Array of column definitions (name, type, width, etc.)
    - style: Object of grid style overrides (see lib/defaults.js styles)
    - Any canvas-datagrid attribute (editable, allowSorting, showFilter, etc.)
    - Any "on*" prop is forwarded as a grid event listener

  Methods (via bind:this):
    - getGrid(): Returns the raw canvas-datagrid instance
-->
<script module>
  // Re-export for convenient access
  export { default as canvasDatagrid } from '../lib/main.js';
</script>

<script>
  import { onMount, tick } from 'svelte';
  import canvasDatagrid from '../lib/main.js';

  // Known top-level keys that map to grid properties (not attributes)
  const TOP_LEVEL_KEYS = new Set([
    'style', 'formatters', 'sorters', 'filters',
    'treeGridAttributes', 'cellGridAttributes', 'fillCellCallback',
    'data', 'schema',
  ]);

  let {
    data = $bindable([]),
    schema = $bindable(undefined),
    style: gridStyle = {},
    formatters = undefined,
    sorters = undefined,
    filters = undefined,
    treeGridAttributes = undefined,
    cellGridAttributes = undefined,
    fillCellCallback = undefined,
    ...restProps
  } = $props();

  let container;
  let grid;
  let eventCleanups = [];

  /**
   * Returns the raw canvas-datagrid instance for direct API access.
   * Use this as an escape hatch when you need methods not exposed as props.
   */
  export function getGrid() {
    return grid;
  }

  // Separate event handlers (on*) from config attributes
  function partitionProps(props) {
    const events = {};
    const attrs = {};
    for (const [key, value] of Object.entries(props)) {
      if (key.startsWith('on') && typeof value === 'function') {
        events[key.slice(2)] = value;
      } else {
        attrs[key] = value;
      }
    }
    return { events, attrs };
  }

  onMount(() => {
    const { events, attrs } = partitionProps(restProps);

    // Create grid instance
    grid = canvasDatagrid({
      parentNode: container,
    });

    // Apply styles
    if (gridStyle && typeof gridStyle === 'object') {
      for (const [k, v] of Object.entries(gridStyle)) {
        grid.style[k] = v;
      }
    }

    // Apply object-type props
    if (formatters) {
      for (const [k, v] of Object.entries(formatters)) {
        grid.formatters[k] = v;
      }
    }
    if (sorters) {
      for (const [k, v] of Object.entries(sorters)) {
        grid.sorters[k] = v;
      }
    }
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        grid.filters[k] = v;
      }
    }
    if (treeGridAttributes) grid.treeGridAttributes = treeGridAttributes;
    if (cellGridAttributes) grid.cellGridAttributes = cellGridAttributes;
    if (fillCellCallback) grid.fillCellCallback = fillCellCallback;

    // Apply config attributes
    for (const [k, v] of Object.entries(attrs)) {
      grid.attributes[k] = v;
    }

    // Apply schema before data so columns are defined
    if (schema) {
      grid.schema = schema;
    }

    // Apply data
    grid.data = data || [];

    // Wire up event listeners
    for (const [eventName, handler] of Object.entries(events)) {
      grid.addEventListener(eventName, handler);
      eventCleanups.push(() => grid.removeEventListener(eventName, handler));
    }

    // Make grid fill container
    grid.style.height = '100%';
    grid.style.width = '100%';

    return () => {
      eventCleanups.forEach((fn) => fn());
      eventCleanups = [];
      if (grid && grid.dispose) {
        grid.dispose();
      }
    };
  });

  // React to data changes
  $effect(() => {
    if (grid && data) {
      grid.data = data;
    }
  });

  // React to schema changes
  $effect(() => {
    if (grid && schema) {
      grid.schema = schema;
    }
  });

  // React to style changes
  $effect(() => {
    if (grid && gridStyle && typeof gridStyle === 'object') {
      for (const [k, v] of Object.entries(gridStyle)) {
        grid.style[k] = v;
      }
    }
  });

  // React to config attribute changes
  $effect(() => {
    if (!grid) return;
    const { attrs } = partitionProps(restProps);
    for (const [k, v] of Object.entries(attrs)) {
      grid.attributes[k] = v;
    }
  });

  // React to event handler changes - rewire listeners
  $effect(() => {
    if (!grid) return;
    const { events } = partitionProps(restProps);

    // Clean up old listeners
    eventCleanups.forEach((fn) => fn());
    eventCleanups = [];

    // Wire new listeners
    for (const [eventName, handler] of Object.entries(events)) {
      grid.addEventListener(eventName, handler);
      eventCleanups.push(() => grid.removeEventListener(eventName, handler));
    }
  });
</script>

<div bind:this={container} class="canvas-datagrid-container"></div>

<style>
  .canvas-datagrid-container {
    width: 100%;
    height: 100%;
  }
</style>
