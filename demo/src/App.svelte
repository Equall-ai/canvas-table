<script>
  import CanvasDatagrid from 'canvas-datagrid/svelte';

  let gridComponent;
  let rowCount = $state(500);
  let columnCount = $state(10);
  let clickInfo = $state('');

  const sampleColumns = [
    'ID', 'Name', 'Email', 'Age', 'City', 'Country',
    'Phone', 'Company', 'Role', 'Salary', 'Start Date',
    'Department', 'Status', 'Rating', 'Notes'
  ];

  const cities = ['New York', 'London', 'Tokyo', 'Paris', 'Berlin', 'Sydney', 'Toronto', 'Mumbai', 'São Paulo', 'Cairo'];
  const countries = ['USA', 'UK', 'Japan', 'France', 'Germany', 'Australia', 'Canada', 'India', 'Brazil', 'Egypt'];
  const companies = ['Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Stark Industries', 'Wayne Enterprises', 'Cyberdyne', 'Weyland-Yutani'];
  const roles = ['Engineer', 'Designer', 'Manager', 'Analyst', 'Director', 'VP', 'Intern', 'Lead'];
  const departments = ['Engineering', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Legal'];
  const statuses = ['Active', 'On Leave', 'Terminated', 'Contract'];

  const statusColors = {
    'Active': { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
    'On Leave': { bg: '#fef9c3', text: '#854d0e', border: '#fef08a' },
    'Terminated': { bg: '#fecaca', text: '#991b1b', border: '#fca5a5' },
    'Contract': { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  };

  const roleColors = {
    'Engineer': '#8b5cf6',
    'Designer': '#ec4899',
    'Manager': '#f59e0b',
    'Analyst': '#06b6d4',
    'Director': '#10b981',
    'VP': '#ef4444',
    'Intern': '#6b7280',
    'Lead': '#3b82f6',
  };

  function generateData(rows, cols) {
    const data = [];
    const colCount = Math.min(cols, sampleColumns.length);
    for (let i = 0; i < rows; i++) {
      const row = {};
      for (let c = 0; c < colCount; c++) {
        const col = sampleColumns[c];
        switch (col) {
          case 'ID': row[col] = i + 1; break;
          case 'Name': row[col] = `Person ${i + 1}`; break;
          case 'Email': row[col] = `person${i + 1}@example.com`; break;
          case 'Age': row[col] = 20 + Math.floor(Math.random() * 45); break;
          case 'City': row[col] = cities[i % cities.length]; break;
          case 'Country': row[col] = countries[i % countries.length]; break;
          case 'Phone': row[col] = `+1-555-${String(1000 + i).slice(-4)}`; break;
          case 'Company': row[col] = companies[i % companies.length]; break;
          case 'Role': row[col] = roles[i % roles.length]; break;
          case 'Salary': row[col] = 40000 + Math.floor(Math.random() * 160000); break;
          case 'Start Date': row[col] = `${2015 + (i % 10)}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`; break;
          case 'Department': row[col] = departments[i % departments.length]; break;
          case 'Status': row[col] = statuses[i % statuses.length]; break;
          case 'Rating': row[col] = (1 + Math.random() * 4).toFixed(1); break;
          case 'Notes': row[col] = `Note for row ${i + 1}`; break;
        }
      }
      data.push(row);
    }
    return data;
  }

  let data = $state(generateData(rowCount, columnCount));

  function refreshGrid() {
    data = generateData(rowCount, columnCount);
  }

  function addRow() {
    const newId = data.length + 1;
    data = [...data, {
      ID: newId,
      Name: `New Person ${newId}`,
      Email: `new${newId}@example.com`,
      Age: 25,
      City: 'New York',
      Country: 'USA',
      Phone: '+1-555-0000',
      Company: 'New Co',
      Role: 'Engineer',
      Salary: 75000,
    }];
  }

  function deleteSelectedRows() {
    const grid = gridComponent?.getGrid();
    if (grid && grid.selectedRows) {
      const selectedIndexes = Object.keys(grid.selectedRows)
        .map(Number)
        .sort((a, b) => b - a);
      const newData = [...data];
      for (const idx of selectedIndexes) {
        newData.splice(idx, 1);
      }
      data = newData;
    }
  }

  function fitColumns() {
    const grid = gridComponent?.getGrid();
    if (grid) {
      grid.fitColumnToValues('all');
    }
  }

  function handleClick(e) {
    const cell = e.cell;
    if (cell) {
      clickInfo = `Clicked: row ${cell.rowIndex}, col "${cell.header?.name || cell.columnIndex}"`;
    }
  }

  function handleSelectionChanged(e) {
    const grid = gridComponent?.getGrid();
    if (grid && grid.selectedRows) {
      const count = Object.keys(grid.selectedRows).length;
      if (count > 0) {
        clickInfo = `${count} row(s) selected`;
      }
    }
  }

  function updateStatus(cell, e) {
    const newValue = e.target.value;
    data[cell.rowIndex].Status = newValue;
    data = [...data];
  }

  function updateRole(cell, e) {
    const newValue = e.target.value;
    data[cell.rowIndex].Role = newValue;
    data = [...data];
  }
</script>

{#snippet statusRenderer(cell)}
  <div class="status-pill" style="background:{statusColors[cell.value]?.bg || '#f3f4f6'};color:{statusColors[cell.value]?.text || '#374151'};border-color:{statusColors[cell.value]?.border || '#d1d5db'};">
    <select value={cell.value} onchange={(e) => updateStatus(cell, e)}>
      {#each statuses as s}
        <option value={s} selected={s === cell.value}>{s}</option>
      {/each}
    </select>
  </div>
{/snippet}

{#snippet roleRenderer(cell)}
  <div class="role-badge" style="color:{roleColors[cell.value] || '#6b7280'};">
    <span class="role-dot" style="background:{roleColors[cell.value] || '#6b7280'};"></span>
    {cell.value}
  </div>
{/snippet}

<div class="demo-layout">
  <header>
    <h1>canvas-datagrid Svelte Component Demo</h1>
    {#if clickInfo}
      <span class="click-info">{clickInfo}</span>
    {/if}
  </header>

  <div class="controls">
    <fieldset>
      <legend>Data</legend>
      <label>
        Rows:
        <input type="number" bind:value={rowCount} min="1" max="100000" />
      </label>
      <label>
        Columns:
        <input type="number" bind:value={columnCount} min="1" max="15" />
      </label>
      <button onclick={refreshGrid}>Regenerate Data</button>
    </fieldset>

    <fieldset>
      <legend>Actions</legend>
      <button onclick={addRow}>Add Row</button>
      <button onclick={deleteSelectedRows}>Delete Selected</button>
      <button onclick={fitColumns}>Fit Columns</button>
    </fieldset>
  </div>

  <div class="grid-container">
    <CanvasDatagrid
      bind:this={gridComponent}
      {data}
      editable={true}
      allowSorting={true}
      showFilter={true}
      animatedCellSelection={true}
      columnRenderers={{ Status: statusRenderer, Role: roleRenderer }}
      onclick={handleClick}
      onselectionchanged={handleSelectionChanged}
    />
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f5f5;
  }

  .demo-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  header {
    padding: 0.5rem 1rem;
    background: #1a1a2e;
    color: white;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  header h1 {
    margin: 0;
    font-size: 1.25rem;
  }

  .click-info {
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .controls {
    display: flex;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: white;
    border-bottom: 1px solid #ddd;
    flex-wrap: wrap;
  }

  fieldset {
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  legend {
    font-size: 0.75rem;
    font-weight: 600;
    color: #666;
    padding: 0 0.25rem;
  }

  label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
  }

  input[type="number"] {
    width: 5rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid #ccc;
    border-radius: 3px;
  }

  button {
    padding: 0.35rem 0.75rem;
    border: 1px solid #ccc;
    border-radius: 3px;
    background: white;
    cursor: pointer;
    font-size: 0.875rem;
  }

  button:hover {
    background: #e8e8e8;
  }

  .grid-container {
    flex: 1;
    overflow: hidden;
  }

  :global(.status-pill) {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    padding: 0 4px;
    box-sizing: border-box;
  }

  :global(.status-pill select) {
    appearance: none;
    -webkit-appearance: none;
    border: none;
    background: transparent;
    color: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 9999px;
    outline: none;
    width: 100%;
    text-align: center;
  }

  :global(.status-pill select:hover) {
    opacity: 0.8;
  }

  :global(.role-badge) {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 100%;
    padding: 0 8px;
    font-size: 0.8rem;
    font-weight: 500;
    box-sizing: border-box;
  }

  :global(.role-dot) {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
