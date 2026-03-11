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
  export { default as canvasDatagrid } from '../lib/main.js';
</script>

<script>
  import { onMount } from 'svelte';
  import canvasDatagrid from '../lib/main.js';

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
  let grid = $state(null);
  let eventCleanups = [];

  export function getGrid() {
    return grid;
  }

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

  function buildConstructorArgs(attrs) {
    const args = {
      parentNode: container,
      data: data || [],
    };
    if (schema) args.schema = schema;
    if (gridStyle && typeof gridStyle === 'object') args.style = gridStyle;
    if (formatters) args.formatters = formatters;
    if (sorters) args.sorters = sorters;
    if (filters) args.filters = filters;
    if (treeGridAttributes) args.treeGridAttributes = treeGridAttributes;
    if (cellGridAttributes) args.cellGridAttributes = cellGridAttributes;
    if (fillCellCallback) args.fillCellCallback = fillCellCallback;
    Object.assign(args, attrs);
    return args;
  }

  onMount(() => {
    const { events, attrs } = partitionProps(restProps);

    grid = canvasDatagrid(buildConstructorArgs(attrs));

    grid.style.height = '100%';
    grid.style.width = '100%';

    for (const [eventName, handler] of Object.entries(events)) {
      grid.addEventListener(eventName, handler);
      eventCleanups.push(() => grid.removeEventListener(eventName, handler));
    }

    return () => {
      eventCleanups.forEach((fn) => fn());
      eventCleanups = [];
      if (grid && grid.dispose) {
        grid.dispose();
      }
    };
  });

  $effect(() => {
    if (grid && data) {
      grid.data = data;
    }
  });

  $effect(() => {
    if (grid && schema) {
      grid.schema = schema;
    }
  });

  $effect(() => {
    if (grid && gridStyle && typeof gridStyle === 'object') {
      for (const [k, v] of Object.entries(gridStyle)) {
        grid.style[k] = v;
      }
    }
  });

  $effect(() => {
    if (!grid) return;
    const { attrs } = partitionProps(restProps);
    for (const [k, v] of Object.entries(attrs)) {
      grid.attributes[k] = v;
    }
  });

  $effect(() => {
    if (!grid) return;
    const { events } = partitionProps(restProps);
    eventCleanups.forEach((fn) => fn());
    eventCleanups = [];
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
