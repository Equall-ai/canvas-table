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

    {#snippet statusRenderer(cell)}
      <select value={cell.value} onchange={(e) => updateStatus(cell, e)}>
        <option>Active</option>
        <option>Inactive</option>
      </select>
    {/snippet}

    <CanvasDatagrid {data} columnRenderers={{ Status: statusRenderer }} />

    <button onclick={() => grid.getGrid().fitColumnToValues('all')}>
      Fit Columns
    </button>

  Props:
    - data: Array of row objects
    - schema: Array of column definitions (name, type, width, etc.)
    - style: Object of grid style overrides (see lib/defaults.js styles)
    - columnRenderers: Object mapping column names to Svelte snippets
      Each snippet receives { value, row, rowIndex, columnIndex, colName }
    - Any canvas-datagrid attribute (editable, allowSorting, showFilter, etc.)
    - Any "on*" prop is forwarded as a grid event listener

  Methods (via bind:this):
    - getGrid(): Returns the raw canvas-datagrid instance
-->
<script module>
  export { default as canvasDatagrid } from '../lib/main.js';
</script>

<script>
  import { onMount, tick } from 'svelte';
  import canvasDatagrid from '../lib/main.js';

  let {
    data = $bindable([]),
    schema = $bindable(undefined),
    style: gridStyle = {},
    columnRenderers = {},
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
  let renderedCells = $state([]);
  let overlayEl;
  let clipTop = 0;
  let clipLeft = 0;

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

  // Snapshot of renderer column names — used in event handlers to avoid
  // reactive reads inside non-reactive callbacks.
  let rendererColumns = new Set();

  function syncRendererColumns() {
    rendererColumns = columnRenderers
      ? new Set(Object.keys(columnRenderers))
      : new Set();
  }

  function handleRenderText(e) {
    const cell = e.cell;
    if (cell && !cell.isHeader && !cell.isRowHeader && !cell.isCorner) {
      if (cell.header?.name && rendererColumns.has(cell.header.name)) {
        e.preventDefault();
      }
    }
  }

  function handleAfterDraw() {
    if (!grid || rendererColumns.size === 0) {
      renderedCells = [];
      return;
    }
    const cells = grid.visibleCells;
    if (!cells || cells.length === 0) {
      renderedCells = [];
      return;
    }
    const scale = grid.scale || 1;
    let headerBottom = 0;
    let rowHeaderRight = 0;
    const newCells = [];
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell.isColumnHeader || cell.isCorner) {
        const bottom = (cell.y + cell.height) / scale;
        if (bottom > headerBottom) headerBottom = bottom;
      }
      if (cell.isRowHeader || cell.isCorner) {
        const right = (cell.x + cell.width) / scale;
        if (right > rowHeaderRight) rowHeaderRight = right;
      }
      if (cell.isHeader || cell.isRowHeader || cell.isCorner) continue;
      const colName = cell.header?.name;
      if (colName && rendererColumns.has(colName)) {
        newCells.push({
          key: cell.rowIndex + ':' + cell.columnIndex,
          colName,
          value: cell.value,
          formattedValue: cell.formattedValue,
          row: cell.data,
          rowIndex: cell.rowIndex,
          columnIndex: cell.columnIndex,
          left: cell.x / scale,
          top: cell.y / scale,
          width: cell.width / scale,
          height: cell.height / scale,
        });
      }
    }
    if (headerBottom !== clipTop || rowHeaderRight !== clipLeft) {
      clipTop = headerBottom;
      clipLeft = rowHeaderRight;
    }
    if (overlayEl) {
      overlayEl.style.clipPath = 'inset(' + clipTop + 'px 0 0 ' + clipLeft + 'px)';
    }
    renderedCells = newCells;
  }

  onMount(() => {
    const { events, attrs } = partitionProps(restProps);

    grid = canvasDatagrid(buildConstructorArgs(attrs));

    grid.style.height = '100%';
    grid.style.width = '100%';

    // Ensure overlay is after the grid web component in DOM order
    // so it paints on top (z-index alone isn't reliable across stacking contexts).
    if (overlayEl) {
      container.appendChild(overlayEl);
    }

    for (const [eventName, handler] of Object.entries(events)) {
      grid.addEventListener(eventName, handler);
      eventCleanups.push(() => grid.removeEventListener(eventName, handler));
    }

    // Renderer listeners are managed by the $effect below, which reacts
    // to columnRenderers changes and handles cleanup automatically.
    syncRendererColumns();

    return () => {
      eventCleanups.forEach((fn) => fn());
      eventCleanups = [];
      renderedCells = [];
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

  $effect(() => {
    if (!grid) return;
    // Read columnRenderers to track it as a dependency
    const cr = columnRenderers;
    syncRendererColumns();
    if (rendererColumns.size > 0) {
      grid.addEventListener('rendertext', handleRenderText);
      grid.addEventListener('afterdraw', handleAfterDraw);
      // Trigger initial overlay population
      handleAfterDraw();
      return () => {
        grid.removeEventListener('rendertext', handleRenderText);
        grid.removeEventListener('afterdraw', handleAfterDraw);
        renderedCells = [];
      };
    } else {
      renderedCells = [];
    }
  });
</script>

<div bind:this={container} class="canvas-datagrid-container">
  <div class="cdg-renderer-overlay" bind:this={overlayEl}>
    {#each renderedCells as cell (cell.key)}
      <div
        class="cdg-renderer-cell"
        style="left:{cell.left}px;top:{cell.top}px;width:{cell.width}px;height:{cell.height}px;"
      >
        {@render columnRenderers[cell.colName](cell)}
      </div>
    {/each}
  </div>
</div>

<style>
  .canvas-datagrid-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .cdg-renderer-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
    overflow: hidden;
  }

  .cdg-renderer-cell {
    position: absolute;
    overflow: hidden;
    pointer-events: auto;
    display: flex;
    align-items: center;
    box-sizing: border-box;
  }
</style>
