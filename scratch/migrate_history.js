const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function migrate() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected!');

    // 1. Check current columns
    const columns = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'matching_history'
    `);
    const columnNames = columns.rows.map(r => r.column_name);
    console.log('Current columns:', columnNames);

    // 2. Add color and size if missing
    if (!columnNames.includes('color')) {
        console.log('Adding color column...');
        await client.query('ALTER TABLE matching_history ADD COLUMN color TEXT');
    }
    if (!columnNames.includes('size')) {
        console.log('Adding size column...');
        await client.query('ALTER TABLE matching_history ADD COLUMN size TEXT');
    }

    // 3. Drop existing constraint if it only covers original_style
    // First, find the constraint name
    const constraintRes = await client.query(`
        SELECT conname FROM pg_constraint 
        WHERE conrelid = 'matching_history'::regclass AND contype = 'u'
    `);
    
    for (const row of constraintRes.rows) {
        console.log(`Dropping constraint ${row.conname}...`);
        await client.query(`ALTER TABLE matching_history DROP CONSTRAINT ${row.conname}`);
    }

    // 4. Add new unique constraint for (original_style, color, size)
    console.log('Adding new unique constraint...');
    await client.query('ALTER TABLE matching_history ADD CONSTRAINT unique_style_color_size UNIQUE (original_style, color, size)');

    console.log('Migration completed successfully!');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

migrate();
