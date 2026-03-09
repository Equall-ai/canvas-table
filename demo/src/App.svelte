<script>
  import { onMount } from 'svelte';
  import canvasDatagrid from 'canvas-datagrid';

  let gridContainer;
  let grid;
  let rowCount = $state(500);
  let columnCount = $state(10);
  let selectedTheme = $state('default');

  const themes = ['default'];

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

  function refreshGrid() {
    if (grid) {
      grid.data = generateData(rowCount, columnCount);
    }
  }

  function addRow() {
    if (grid) {
      const newId = grid.data.length + 1;
      grid.data.push({
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
      });
      grid.draw();
    }
  }

  function deleteSelectedRows() {
    if (grid && grid.selectedRows) {
      const selectedIndexes = Object.keys(grid.selectedRows)
        .map(Number)
        .sort((a, b) => b - a);
      for (const idx of selectedIndexes) {
        grid.data.splice(idx, 1);
      }
      grid.draw();
    }
  }

  function fitColumns() {
    if (grid) {
      grid.fitColumnToValues('all');
    }
  }

  onMount(() => {
    grid = canvasDatagrid({
      parentNode: gridContainer,
      data: generateData(rowCount, columnCount),
    });

    grid.style.height = '100%';
    grid.style.width = '100%';

    return () => {
      if (grid && grid.dispose) {
        grid.dispose();
      }
    };
  });
</script>

<div class="demo-layout">
  <header>
    <h1>canvas-datagrid Demo</h1>
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

  <div class="grid-container" bind:this={gridContainer}></div>
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
  }

  header h1 {
    margin: 0;
    font-size: 1.25rem;
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
</style>
