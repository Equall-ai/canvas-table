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
    cellStyle = undefined,
    animateRows = false,
    testMode = false,
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
  let testCells = $state([]);

  // Row animation state
  let prevIdSet = new Set();
  let prevData = []; // previous data array for removal reconstruction
  let animatingRows = new Map(); // rowIndex -> { start, duration, from, to }
  let animFrameId = null;
  let pendingRemovalData = null; // deferred data to apply after removal animation
  let skipNextAnimCheck = false;

  function getAnimConfig() {
    if (!animateRows) return null;
    if (animateRows === true) return { duration: 200, key: 'id' };
    return { duration: animateRows.duration || 200, key: animateRows.key || 'id' };
  }

  function animateDataChange(newData, oldIdSet, oldData) {
    if (!grid) return;
    const cfg = getAnimConfig();
    if (!cfg) return;

    const key = cfg.key;
    const cellHeight = grid.style.cellHeight || 25;
    const now = performance.now();

    // Build new ID set
    const newIdSet = new Set();
    for (let i = 0; i < newData.length; i++) {
      const id = newData[i][key];
      if (id != null) newIdSet.add(id);
    }

    // Find inserted IDs
    const insertedIds = new Set();
    for (let i = 0; i < newData.length; i++) {
      const id = newData[i][key];
      if (id != null && !oldIdSet.has(id)) insertedIds.add(id);
    }

    // Find removed IDs
    const removedIdSet = new Set();
    for (const id of oldIdSet) {
      if (!newIdSet.has(id)) removedIdSet.add(id);
    }

    // Clear any in-progress animations
    for (const [idx] of animatingRows) {
      delete grid.sizes.rows[idx];
    }
    animatingRows.clear();

    const hasInsertions = insertedIds.size > 0;
    const hasRemovals = removedIdSet.size > 0;
    if (!hasInsertions && !hasRemovals) return;

    if (hasRemovals) {
      // Reconstruct the old data order: keep all old rows (including removed ones)
      // but with surviving rows updated to their new values
      const newDataById = new Map();
      for (const row of newData) {
        const id = row[key];
        if (id != null) newDataById.set(id, row);
      }

      const mergedData = [];
      const removedIndices = [];
      for (const row of oldData) {
        const id = row[key];
        if (removedIdSet.has(id)) {
          removedIndices.push(mergedData.length);
          mergedData.push(row);
        } else if (newDataById.has(id)) {
          mergedData.push(newDataById.get(id));
          newDataById.delete(id);
        }
      }
      // Append any new rows (insertions) at their correct positions
      // We need to interleave them properly. For simplicity, handle
      // insertions separately after the removal animation.
      for (const row of newData) {
        const id = row[key];
        if (id != null && insertedIds.has(id)) {
          mergedData.push(row);
        }
      }

      skipNextAnimCheck = true;
      grid.data = mergedData;

      for (const idx of removedIndices) {
        grid.sizes.rows[idx] = cellHeight;
        animatingRows.set(idx, {
          start: now,
          duration: cfg.duration,
          from: cellHeight,
          to: 0,
        });
      }

      pendingRemovalData = newData;
    }

    // Handle insertions (only if no removals — otherwise handled after removal completes)
    if (hasInsertions && !hasRemovals) {
      for (let i = 0; i < newData.length; i++) {
        const id = newData[i][key];
        if (id != null && insertedIds.has(id)) {
          grid.sizes.rows[i] = 0.1;
          animatingRows.set(i, {
            start: now,
            duration: cfg.duration,
            from: 0,
            to: cellHeight,
          });
        }
      }
    }

    if (!animFrameId) {
      animFrameId = requestAnimationFrame(animationTick);
    }
  }

  function animationTick(now) {
    if (!grid || animatingRows.size === 0) {
      animFrameId = null;
      applyPendingRemoval();
      return;
    }

    let anyActive = false;
    for (const [idx, anim] of animatingRows) {
      const elapsed = now - anim.start;
      const progress = Math.min(elapsed / anim.duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentHeight = anim.from + eased * (anim.to - anim.from);

      if (progress >= 1) {
        delete grid.sizes.rows[idx];
        animatingRows.delete(idx);
      } else {
        grid.sizes.rows[idx] = Math.max(0.1, currentHeight);
        anyActive = true;
      }
    }

    grid.draw();

    if (anyActive) {
      animFrameId = requestAnimationFrame(animationTick);
    } else {
      animFrameId = null;
      applyPendingRemoval();
    }
  }

  function applyPendingRemoval() {
    if (pendingRemovalData && grid) {
      const finalData = pendingRemovalData;
      pendingRemovalData = null;
      skipNextAnimCheck = true;
      grid.data = finalData;
      grid.draw();
    }
  }

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

  const shadowPresets = {
    none: { height: 0, color: 'rgba(0,0,0,0)' },
    sm: { height: 3, color: 'rgba(0,0,0,0.08)' },
    md: { height: 6, color: 'rgba(0,0,0,0.12)' },
    lg: { height: 10, color: 'rgba(0,0,0,0.18)' },
  };

  function getCellStyleObj(cell) {
    if (!cellStyle) return null;
    return cellStyle({
      value: cell.value,
      row: cell.data,
      rowIndex: cell.rowIndex,
      columnIndex: cell.columnIndex,
      colName: cell.header?.name,
      header: cell.header,
    });
  }

  function handleRenderCell(e) {
    if (!cellStyle) return;
    const cell = e.cell;
    if (!cell || cell.isHeader || cell.isRowHeader || cell.isCorner) return;
    const s = getCellStyleObj(cell);
    if (!s) return;
    const ctx = e.ctx;
    if (s.backgroundColor) ctx.fillStyle = s.backgroundColor;
    if (s.borderColor) ctx.strokeStyle = s.borderColor;
    if (s.borderWidth != null) ctx.lineWidth = s.borderWidth;
  }

  function handleAfterRenderCell(e) {
    if (!cellStyle) return;
    const cell = e.cell;
    if (!cell || cell.isHeader || cell.isRowHeader || cell.isCorner) return;
    const s = getCellStyleObj(cell);
    if (!s || !s.shadow || s.shadow === 'none') return;
    const preset = shadowPresets[s.shadow] || shadowPresets.none;
    if (!preset.height) return;
    const ctx = e.ctx;
    const scale = grid?.scale || 1;
    const y = cell.offsetTop;
    const x = cell.offsetLeft;
    const h = preset.height * scale;
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, preset.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, cell.width, h);
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
        return;
      }
    }
    // Apply cellStyle text overrides
    if (cellStyle && !cell.isHeader && !cell.isRowHeader && !cell.isCorner) {
      const s = getCellStyleObj(cell);
      if (s) {
        const ctx = e.ctx;
        if (s.color) ctx.fillStyle = s.color;
        if (s.font) {
          ctx.font = s.font;
        } else if (s.fontWeight) {
          ctx.font = s.fontWeight + ' ' + ctx.font;
        }
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
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const newCells = [];
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell.isHeader || cell.isRowHeader || cell.isCorner) continue;
      const colName = cell.header?.name;
      if (colName && columnRenderers[colName]) {
        const left = cell.x / scale;
        const top = cell.y / scale;
        const clippedWidth = Math.min(cell.width / scale, containerWidth - left);
        const clippedHeight = Math.min(cell.height / scale, containerHeight - top);
        if (clippedWidth <= 0 || clippedHeight <= 0) continue;
        newCells.push({
          key: cell.rowIndex + ':' + cell.columnIndex,
          colName,
          value: cell.value,
          formattedValue: cell.formattedValue,
          row: cell.data,
          rowIndex: cell.rowIndex,
          columnIndex: cell.columnIndex,
          left,
          top,
          width: clippedWidth,
          height: clippedHeight,
        });
      }
    }
    renderedCells = newCells;
  }

  function updateTestOverlays() {
    if (!grid || !testMode) {
      testCells = [];
      return;
    }
    const cells = grid.visibleCells;
    if (!cells) { testCells = []; return; }
    const scale = grid.scale || 1;
    const newTestCells = [];
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell.isCorner) continue;
      newTestCells.push({
        key: (cell.isColumnHeader ? 'h' : cell.isRowHeader ? 'rh' : 'c') + ':' + cell.rowIndex + ':' + cell.columnIndex,
        left: cell.x / scale,
        top: cell.y / scale,
        width: cell.width / scale,
        height: cell.height / scale,
        rowIndex: cell.rowIndex,
        columnIndex: cell.columnIndex,
        colName: cell.header?.name || '',
        value: cell.value != null ? String(cell.value) : '',
        isHeader: cell.isColumnHeader || false,
        isRowHeader: cell.isRowHeader || false,
      });
    }
    testCells = newTestCells;
  }

  function handleAfterDraw() {
    updateRendererOverlays();
    updateHeaderOverlays();
    updateTestOverlays();
  }

  function preventBackGesture(e) {
    // Prevent horizontal scroll from triggering browser back/forward navigation
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
    }
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

    // Prevent horizontal scroll from triggering browser back/forward gesture
    container.addEventListener('wheel', preventBackGesture, { passive: false });

    // Suppress the default context menu
    container.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });


    for (const [eventName, handler] of Object.entries(events)) {
      grid.addEventListener(eventName, handler);
      eventCleanups.push(() => grid.removeEventListener(eventName, handler));
    }

    if (hasRenderers() || htmlHeaders || cellStyle) {
      grid.addEventListener('rendertext', handleRenderText);
      rendererCleanups.push(
        () => grid.removeEventListener('rendertext', handleRenderText),
      );
    }

    if (hasRenderers() || htmlHeaders || testMode) {
      grid.addEventListener('afterdraw', handleAfterDraw);
      rendererCleanups.push(
        () => grid.removeEventListener('afterdraw', handleAfterDraw),
      );
    }

    if (cellStyle) {
      grid.addEventListener('rendercell', handleRenderCell);
      grid.addEventListener('afterrendercell', handleAfterRenderCell);
      rendererCleanups.push(
        () => grid.removeEventListener('rendercell', handleRenderCell),
        () => grid.removeEventListener('afterrendercell', handleAfterRenderCell),
      );
    }

    return () => {
      eventCleanups.forEach((fn) => fn());
      eventCleanups = [];
      rendererCleanups.forEach((fn) => fn());
      rendererCleanups = [];
      renderedCells = [];
      renderedHeaders = [];
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      animatingRows.clear();
      container?.removeEventListener('wheel', preventBackGesture);
      if (grid && grid.dispose) {
        grid.dispose();
      }
    };
  });

  $effect(() => {
    if (grid && data) {
      const cfg = getAnimConfig();
      const oldIdSet = prevIdSet;
      const oldDataArr = prevData;

      // Update tracking state
      if (cfg) {
        const newSet = new Set();
        for (let i = 0; i < data.length; i++) {
          const id = data[i][cfg.key];
          if (id != null) newSet.add(id);
        }
        prevIdSet = newSet;
        prevData = data;
      }

      if (skipNextAnimCheck) {
        skipNextAnimCheck = false;
        return;
      }

      grid.data = data;

      if (cfg && oldIdSet.size > 0) {
        animateDataChange(data, oldIdSet, oldDataArr);
      }
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
      // Some properties (frozenColumn, frozenRow) are top-level grid
      // properties, not attributes. Check the grid interface first.
      if (k in grid) {
        grid[k] = v;
      } else {
        grid.attributes[k] = v;
      }
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

    if (hasRenderers() || htmlHeaders || cellStyle) {
      grid.addEventListener('rendertext', handleRenderText);
      rendererCleanups.push(
        () => grid.removeEventListener('rendertext', handleRenderText),
      );
    }

    if (hasRenderers() || htmlHeaders || testMode) {
      grid.addEventListener('afterdraw', handleAfterDraw);
      rendererCleanups.push(
        () => grid.removeEventListener('afterdraw', handleAfterDraw),
      );
      updateRendererOverlays();
      updateHeaderOverlays();
      updateTestOverlays();
      if (testMode) grid.draw();
    } else {
      renderedCells = [];
      renderedHeaders = [];
    }

    if (cellStyle) {
      grid.addEventListener('rendercell', handleRenderCell);
      grid.addEventListener('afterrendercell', handleAfterRenderCell);
      rendererCleanups.push(
        () => grid.removeEventListener('rendercell', handleRenderCell),
        () => grid.removeEventListener('afterrendercell', handleAfterRenderCell),
      );
    }
  });

  // Resize grid when container size changes.
  // Uses $effect so the observer is set up after the grid is fully initialized.
  $effect(() => {
    if (!grid || !container) return;
    const resizeObserver = new ResizeObserver(() => {
      window.dispatchEvent(new Event('resize'));
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
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
  {#if testCells.length > 0}
    <div class="cdg-test-overlay">
      {#each testCells as cell (cell.key)}
        <div
          class="cdg-test-cell"
          data-testid={cell.isHeader ? `header-${cell.colName}` : `cell-${cell.rowIndex}-${cell.columnIndex}`}
          data-row={cell.rowIndex}
          data-col={cell.columnIndex}
          data-column={cell.colName}
          data-value={cell.value}
          data-header={cell.isHeader || undefined}
          data-row-header={cell.isRowHeader || undefined}
          style="left:{cell.left}px;top:{cell.top}px;width:{cell.width}px;height:{cell.height}px;"
        ></div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .canvas-datagrid-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    overscroll-behavior-x: none;
    touch-action: none;
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

  .cdg-test-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }

  .cdg-test-cell {
    position: absolute;
    pointer-events: auto;
    background: transparent;
    box-sizing: border-box;
  }
</style>
