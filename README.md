# @equall/canvas-table

A high-performance canvas-based data grid with first-class Svelte 5 support. Renders millions of rows on a single `<canvas>` element with sortable columns, inline editing, filtering, keyboard navigation, and custom column renderers via Svelte snippets.

Based on [canvas-datagrid](https://github.com/TonyGermaneri/canvas-datagrid).

## Installation

```bash
npm install @equall/canvas-table
```

## Svelte 5 Component

```svelte
<script>
  import CanvasDatagrid from '@equall/canvas-table/svelte';

  const data = [
    { name: 'Alice', age: 30, city: 'New York' },
    { name: 'Bob', age: 25, city: 'London' },
  ];
</script>

<CanvasDatagrid {data} editable allowSorting showFilter />
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `data` | `Array<object>` | Array of row objects (bindable) |
| `schema` | `Array<object>` | Column definitions (`{ name, type, width }`) (bindable) |
| `style` | `object` | Grid style overrides (see [style properties](#style-properties)) |
| `columnRenderers` | `object` | Map of column names to Svelte snippets |
| `formatters` | `object` | Custom cell formatters |
| `sorters` | `object` | Custom sort functions |
| `filters` | `object` | Custom filter functions |
| `on*` | `function` | Any `on`-prefixed prop is forwarded as a grid event listener |
| *any other* | `any` | Passed as a grid attribute (e.g. `editable`, `allowSorting`) |

### Events

Pass event handlers as `on*` props:

```svelte
<CanvasDatagrid
  {data}
  onclick={(e) => console.log('clicked', e.cell)}
  onselectionchanged={(e) => console.log('selection changed')}
  onafterrendercell={(e) => { /* custom cell rendering */ }}
/>
```

Common events: `click`, `dblclick`, `selectionchanged`, `beforerendercell`, `rendercell`, `afterrendercell`, `afterdraw`, `contextmenu`, `keydown`, `scroll`.

### Schema

Define column types, widths, and display names:

```svelte
<script>
  const schema = [
    { name: 'name', type: 'string', width: 200 },
    { name: 'age', type: 'number', width: 100 },
    { name: 'email', type: 'string', width: 250 },
  ];
</script>

<CanvasDatagrid {data} {schema} />
```

If no schema is provided, columns are auto-detected from the data.

### Accessing the Grid Instance

Use `bind:this` and `getGrid()` for escape-hatch access to the underlying canvas-datagrid API:

```svelte
<script>
  let gridComponent;

  function fitColumns() {
    gridComponent.getGrid().fitColumnToValues('all');
  }
</script>

<CanvasDatagrid bind:this={gridComponent} {data} />
<button onclick={fitColumns}>Fit Columns</button>
```

### Animated Cell Selection

Enable a smooth DOM-based selection overlay that animates between cells:

```svelte
<CanvasDatagrid
  {data}
  animatedCellSelection={true}
  animatedCellSelectionDuration={150}
  animatedCellSelectionBorderRadius={5}
/>
```

| Attribute | Default | Description |
|-----------|---------|-------------|
| `animatedCellSelection` | `false` | Enable DOM-based selection overlay |
| `animatedCellSelectionDuration` | `150` | Transition duration in ms |
| `animatedCellSelectionBorderRadius` | `5` | Border radius of selection box in px |

### Column Renderers

Overlay Svelte snippets on specific columns to replace the default canvas-drawn text with interactive DOM elements:

```svelte
<script>
  import CanvasDatagrid from '@equall/canvas-table/svelte';

  let data = $state([
    { name: 'Alice', status: 'Active' },
    { name: 'Bob', status: 'On Leave' },
  ]);

  const statusColors = {
    'Active': '#dcfce7',
    'On Leave': '#fef9c3',
  };

  function updateStatus(cell, e) {
    data[cell.rowIndex].status = e.target.value;
    data = [...data];
  }
</script>

{#snippet statusRenderer(cell)}
  <div style="background:{statusColors[cell.value]};padding:2px 8px;border-radius:9999px;">
    <select value={cell.value} onchange={(e) => updateStatus(cell, e)}>
      <option>Active</option>
      <option>On Leave</option>
    </select>
  </div>
{/snippet}

<CanvasDatagrid
  {data}
  columnRenderers={{ status: statusRenderer }}
/>
```

Each snippet receives a cell object with:

| Property | Type | Description |
|----------|------|-------------|
| `value` | `any` | The cell's current value |
| `row` | `object` | The full row data object |
| `rowIndex` | `number` | Row index in the data array |
| `columnIndex` | `number` | Column index |
| `colName` | `string` | Column name |
| `formattedValue` | `string` | Formatted display value |

Renderer overlays are positioned absolutely over the canvas cells, updated on every draw cycle, and automatically recycled as rows scroll in and out of view.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Arrow keys | Navigate between cells |
| Shift + Arrow | Extend selection |
| Cmd/Ctrl + Arrow | Jump to edge of data |
| Enter | Begin editing / confirm edit |
| Escape | Cancel editing |
| Tab | Move to next cell |

## Vanilla JavaScript

```js
import canvasDatagrid from '@equall/canvas-table';

const grid = canvasDatagrid({
  parentNode: document.getElementById('grid'),
  data: [
    { col1: 'row 1 column 1', col2: 'row 1 column 2' },
    { col1: 'row 2 column 1', col2: 'row 2 column 2' },
  ],
});
```

## Web Component

```html
<canvas-datagrid data='[{"col1": "value1", "col2": "value2"}]'></canvas-datagrid>
```

## Style Properties

Pass style overrides via the `style` prop:

```svelte
<CanvasDatagrid
  {data}
  style={{
    cellHeight: 30,
    cellFont: '14px sans-serif',
    activeCellOverlayBorderColor: '#1a73e8',
    activeCellOverlayBorderWidth: 2,
  }}
/>
```

See the [full style reference](https://canvas-datagrid.js.org/) for all available properties.

## Building & Testing

```bash
npm install
npm run build
npm test
```

## License

BSD-3-Clause
