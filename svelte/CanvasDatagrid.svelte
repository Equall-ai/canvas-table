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
    htmlHeaders = false,
    columnHeaderRenderers = {},
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
  let rendererCleanups = [];
  let renderedCells = $state([]);
  let renderedHeaders = $state([]);
  let headerStyles = $state({});

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

  function hasRenderers() {
    return columnRenderers && Object.keys(columnRenderers).length > 0;
  }

  function handleRenderText(e) {
    const cell = e.cell;
    if (!cell) return;
    // Suppress header text when htmlHeaders is enabled
    if (htmlHeaders && cell.isColumnHeader && !cell.isRowHeader && !cell.isCorner) {
      e.preventDefault();
      return;
    }
    // Suppress cell text for custom column renderers
    if (hasRenderers() && !cell.isHeader && !cell.isRowHeader && !cell.isCorner) {
      const colName = cell.header?.name;
      if (colName && columnRenderers[colName]) {
        e.preventDefault();
      }
    }
  }

  function getHeaderStyles() {
    if (!grid) return {};
    const s = grid.style;
    return {
      backgroundColor: s.columnHeaderCellBackgroundColor || 'rgba(240, 240, 240, 1)',
      borderColor: s.columnHeaderCellBorderColor || 'rgba(172, 172, 172, 1)',
      borderWidth: (s.columnHeaderCellBorderWidth ?? 1) + 'px',
      color: s.columnHeaderCellColor || 'rgba(50, 50, 50, 1)',
      font: s.columnHeaderCellFont || '16px sans-serif',
      paddingLeft: (s.columnHeaderCellPaddingLeft ?? 5) + 'px',
      paddingRight: (s.columnHeaderCellPaddingRight ?? 5) + 'px',
      paddingTop: (s.columnHeaderCellPaddingTop ?? 5) + 'px',
      paddingBottom: (s.columnHeaderCellPaddingBottom ?? 5) + 'px',
      textAlign: s.columnHeaderCellHorizontalAlignment || 'left',
      hoverBackgroundColor: s.columnHeaderCellHoverBackgroundColor || 'rgba(235, 235, 235, 1)',
      hoverColor: s.columnHeaderCellHoverColor || 'rgba(0, 0, 0, 1)',
    };
  }

  function updateHeaderOverlays() {
    if (!grid || !htmlHeaders) {
      renderedHeaders = [];
      return;
    }
    const cells = grid.visibleCells;
    if (!cells) {
      renderedHeaders = [];
      return;
    }
    const scale = grid.scale || 1;
    const newHeaders = [];
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (!cell.isColumnHeader || cell.isRowHeader || cell.isCorner || cell.isColumnHeaderCellCap) continue;
      const colName = cell.header?.name;
      if (!colName) continue;
      newHeaders.push({
        key: 'h:' + cell.columnIndex,
        colName,
        title: cell.header?.title || colName,
        columnIndex: cell.columnIndex,
        left: cell.x / scale,
        top: cell.y / scale,
        width: cell.width / scale,
        height: cell.height / scale,
        sortDirection: grid.orderBy === colName ? grid.orderDirection : null,
      });
    }
    headerStyles = getHeaderStyles();
    renderedHeaders = newHeaders;
  }

  function handleHeaderClick(header) {
    if (!grid) return;
    const currentDir = grid.orderBy === header.colName ? grid.orderDirection : null;
    grid.order(header.colName, currentDir === 'asc' ? 'desc' : 'asc');
  }

  function updateRendererOverlays() {
    if (!grid || !hasRenderers()) {
      renderedCells = [];
      return;
    }
    const cells = grid.visibleCells;
    if (!cells) {
      renderedCells = [];
      return;
    }
    const scale = grid.scale || 1;
    const newCells = [];
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell.isHeader || cell.isRowHeader || cell.isCorner) continue;
      const colName = cell.header?.name;
      if (colName && columnRenderers[colName]) {
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
    renderedCells = newCells;
  }

  function handleAfterDraw() {
    updateRendererOverlays();
    updateHeaderOverlays();
  }

  function forwardWheel(e) {
    if (!grid) return;
    const canvas = container.querySelector('canvas-datagrid')?.shadowRoot?.querySelector('canvas')
      || container.querySelector('canvas');
    if (canvas) {
      canvas.dispatchEvent(new WheelEvent('wheel', e));
      e.preventDefault();
    }
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

    if (hasRenderers() || htmlHeaders) {
      grid.addEventListener('rendertext', handleRenderText);
      grid.addEventListener('afterdraw', handleAfterDraw);
      rendererCleanups.push(
        () => grid.removeEventListener('rendertext', handleRenderText),
        () => grid.removeEventListener('afterdraw', handleAfterDraw),
      );
    }

    return () => {
      eventCleanups.forEach((fn) => fn());
      eventCleanups = [];
      rendererCleanups.forEach((fn) => fn());
      rendererCleanups = [];
      renderedCells = [];
      renderedHeaders = [];
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
    rendererCleanups.forEach((fn) => fn());
    rendererCleanups = [];
    if (hasRenderers() || htmlHeaders) {
      grid.addEventListener('rendertext', handleRenderText);
      grid.addEventListener('afterdraw', handleAfterDraw);
      rendererCleanups.push(
        () => grid.removeEventListener('rendertext', handleRenderText),
        () => grid.removeEventListener('afterdraw', handleAfterDraw),
      );
      updateRendererOverlays();
      updateHeaderOverlays();
    } else {
      renderedCells = [];
      renderedHeaders = [];
    }
  });
</script>

<div bind:this={container} class="canvas-datagrid-container">
  {#if renderedCells.length > 0}
    <div class="cdg-renderer-overlay" onwheel={forwardWheel}>
      {#each renderedCells as cell (cell.key)}
        <div
          class="cdg-renderer-cell"
          style="left:{cell.left}px;top:{cell.top}px;width:{cell.width}px;height:{cell.height}px;"
        >
          {@render columnRenderers[cell.colName](cell)}
        </div>
      {/each}
    </div>
  {/if}
  {#if renderedHeaders.length > 0}
    <div class="cdg-header-overlay">
      {#each renderedHeaders as header (header.key)}
        <button
          class="cdg-header-cell"
          style="left:{header.left}px;top:{header.top}px;width:{header.width}px;height:{header.height}px;background:{headerStyles.backgroundColor};color:{headerStyles.color};font:{headerStyles.font};text-align:{headerStyles.textAlign};padding:{headerStyles.paddingTop} {headerStyles.paddingRight} {headerStyles.paddingBottom} {headerStyles.paddingLeft};border:none;border-right:{headerStyles.borderWidth} solid {headerStyles.borderColor};border-bottom:{headerStyles.borderWidth} solid {headerStyles.borderColor};"
          onclick={() => handleHeaderClick(header)}
        >
          {#if columnHeaderRenderers[header.colName]}
            {@render columnHeaderRenderers[header.colName](header)}
          {:else}
            <span class="cdg-header-text">{header.title}</span>
            {#if header.sortDirection}
              <span class="cdg-header-sort">{header.sortDirection === 'asc' ? '▲' : '▼'}</span>
            {/if}
          {/if}
        </button>
      {/each}
    </div>
  {/if}
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

  .cdg-header-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
    overflow: hidden;
  }

  .cdg-header-cell {
    position: absolute;
    overflow: hidden;
    pointer-events: auto;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    cursor: pointer;
    outline: none;
    margin: 0;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .cdg-header-cell:hover {
    filter: brightness(0.97);
  }

  .cdg-header-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cdg-header-sort {
    margin-left: 4px;
    font-size: 0.7em;
    opacity: 0.6;
  }
</style>
