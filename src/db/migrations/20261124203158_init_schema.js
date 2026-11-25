/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('full_name').notNullable();
    t.string('email').notNullable().unique();
    t.string('phone');
    t.string('password_hash');
    t.enu('role', ['sponsor', 'field_officer', 'program_manager', 'admin'], { useNative: true, enumName: 'user_role' }).notNullable();
    t.string('region');
    t.enu('status', ['pending', 'active', 'inactive'], { useNative: true, enumName: 'user_status' }).notNullable().defaultTo('pending');
    t.timestamp('email_verified_at');
    t.string('mfa_secret');
    t.boolean('mfa_enabled').notNullable().defaultTo(false);
    t.integer('failed_login_count').notNullable().defaultTo(0);
    t.timestamp('locked_until');
    t.timestamp('last_login_at');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('email_tokens', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('type').notNullable(); // verify_email | reset_password | invite
    t.string('token_hash').notNullable().index();
    t.timestamp('expires_at').notNullable();
    t.timestamp('used_at');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('login_attempts', (t) => {
    t.bigIncrements('id');
    t.string('email');
    t.uuid('user_id');
    t.boolean('success').notNullable();
    t.string('ip');
    t.string('user_agent');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('programs', (t) => {
    t.increments('id');
    t.string('name').notNullable().unique();
  });

  await knex.raw('CREATE SEQUENCE child_code_seq START 1');
  await knex.schema.createTable('children', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('code').notNullable().unique().defaultTo(knex.raw("'CH-' || lpad(nextval('child_code_seq')::text, 3, '0')"));
    t.string('full_name').notNullable();
    t.date('date_of_birth').notNullable();
    t.enu('gender', ['female', 'male'], { useNative: true, enumName: 'child_gender' }).notNullable();
    t.string('guardian_name').notNullable();
    t.integer('program_id').references('id').inTable('programs');
    t.string('region');
    t.string('school');
    t.enu('status', ['pending', 'active', 'transitioned', 'closed'], { useNative: true, enumName: 'child_status' }).notNullable().defaultTo('pending');
    t.uuid('field_officer_id').references('id').inTable('users').onDelete('SET NULL');
    t.string('photo_path');
    t.timestamps(true, true);
    t.index(['region']);
    t.index(['status']);
  });

  await knex.schema.createTable('child_enrollments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('child_id').notNullable().references('id').inTable('children').onDelete('CASCADE');
    t.integer('program_id').references('id').inTable('programs');
    t.string('school');
    t.date('started_on').defaultTo(knex.fn.now());
    t.date('ended_on');
  });

  await knex.schema.createTable('case_notes', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('child_id').notNullable().references('id').inTable('children').onDelete('CASCADE');
    t.uuid('author_id').references('id').inTable('users').onDelete('SET NULL');
    t.string('type').notNullable().defaultTo('note'); // note | intervention
    t.text('body').notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('sponsorships', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('sponsor_id').notNullable().references('id').inTable('users');
    t.uuid('child_id').notNullable().references('id').inTable('children');
    t.enu('status', ['pending', 'active', 'ended'], { useNative: true, enumName: 'sponsorship_status' }).notNullable().defaultTo('active');
    t.date('started_on').notNullable().defaultTo(knex.fn.now());
    t.date('ended_on');
    t.string('end_reason');
    t.timestamps(true, true);
  });
  // one active sponsorship per child
  await knex.raw("CREATE UNIQUE INDEX one_active_sponsorship_per_child ON sponsorships(child_id) WHERE status = 'active'");

  await knex.schema.createTable('contributions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('sponsorship_id').notNullable().references('id').inTable('sponsorships').onDelete('CASCADE');
    t.decimal('amount', 12, 2).notNullable();
    t.string('currency', 3).notNullable().defaultTo('USD');
    t.string('status').notNullable().defaultTo('completed'); // pending | completed | failed
    t.string('reference');
    t.timestamp('paid_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('messages', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('child_id').notNullable().references('id').inTable('children').onDelete('CASCADE');
    t.uuid('sender_id').notNullable().references('id').inTable('users');
    t.uuid('sponsor_id').notNullable().references('id').inTable('users');
    t.text('body').notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('kpi_indicators', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable().unique();
    t.enu('dimension', ['education', 'health', 'spiritual', 'welfare'], { useNative: true, enumName: 'kpi_dimension' }).notNullable();
    t.string('target_operator').notNullable().defaultTo('>=');
    t.decimal('target_value', 10, 2).notNullable();
    t.string('frequency').notNullable().defaultTo('quarterly'); // monthly | quarterly | annual
    t.string('value_type').notNullable().defaultTo('percentage'); // percentage | boolean | scale
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('kpi_assessments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('child_id').notNullable().references('id').inTable('children').onDelete('CASCADE');
    t.uuid('officer_id').references('id').inTable('users').onDelete('SET NULL');
    t.string('period').notNullable(); // e.g. 2026-Q4
    t.enu('status', ['draft', 'submitted'], { useNative: true, enumName: 'assessment_status' }).notNullable().defaultTo('draft');
    t.decimal('gps_lat', 9, 6);
    t.decimal('gps_lng', 9, 6);
    t.timestamp('submitted_at');
    t.timestamps(true, true);
    t.unique(['child_id', 'period']);
  });

  await knex.schema.createTable('kpi_entries', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('assessment_id').notNullable().references('id').inTable('kpi_assessments').onDelete('CASCADE');
    t.uuid('indicator_id').notNullable().references('id').inTable('kpi_indicators');
    t.decimal('value', 10, 2);
    t.string('status').notNullable().defaultTo('not_assessed'); // on_track | at_risk | not_met | not_assessed
    t.integer('score');
    t.unique(['assessment_id', 'indicator_id']);
  });

  await knex.schema.createTable('tasks', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('officer_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.uuid('child_id').references('id').inTable('children').onDelete('CASCADE');
    t.string('type').notNullable();
    t.date('due_date').notNullable();
    t.enu('status', ['pending', 'in_progress', 'completed'], { useNative: true, enumName: 'task_status' }).notNullable().defaultTo('pending');
    t.string('region');
    t.text('notes');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('notifications', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('type').notNullable().defaultTo('system'); // kpi_alert | task | message | system
    t.string('title').notNullable();
    t.text('body');
    t.timestamp('read_at');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['user_id', 'read_at']);
  });

  await knex.schema.createTable('documents', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('child_id').references('id').inTable('children').onDelete('CASCADE');
    t.uuid('uploaded_by').references('id').inTable('users').onDelete('SET NULL');
    t.string('name').notNullable();
    t.string('doc_type').notNullable().defaultTo('other'); // birth_certificate | health_record | photo | report | other
    t.string('file_path').notNullable();
    t.string('mime_type');
    t.integer('size_bytes');
    t.integer('version').notNullable().defaultTo(1);
    t.uuid('previous_version_igen_random_uuidd');
    t.boolean('shared_with_sponsor').notNullable().defaultTo(false);
    t.date('expires_on');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('reports', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable();
    t.string('template').notNullable(); // sponsor_progress | program_summary | donor_impact
    t.string('format').notNullable().defaultTo('csv');
    t.jsonb('params').defaultTo('{}');
    t.string('file_path');
    t.uuid('generated_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('audit_logs', (t) => {
    t.bigIncrements('id');
    t.uuid('user_id');
    t.string('user_email');
    t.string('action').notNullable();
    t.string('entity');
    t.string('entity_id');
    t.jsonb('details');
    t.string('ip');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['created_at']);
  });

  await knex.schema.createTable('integrations', (t) => {
    t.string('key').primary();
    t.string('name').notNullable();
    t.string('status').notNullable().defaultTo('disconnected'); // connected | disconnected | error
    t.jsonb('config').defaultTo('{}');
    t.timestamp('last_sync_at');
    t.text('last_error');
  });
}

export async function down(knex) {
  for (const t of ['integrations','audit_logs','reports','documents','notifications','tasks','kpi_entries','kpi_assessments','kpi_indicators','messages','contributions','sponsorships','case_notes','child_enrollments','children','programs','login_attempts','email_tokens','users']) {
    await knex.schema.dropTableIfExists(t);
  }
  await knex.raw('DROP SEQUENCE IF EXISTS child_code_seq');
  for (const e of ['user_role','user_status','child_gender','child_status','sponsorship_status','kpi_dimension','assessment_status','task_status']) {
    await knex.raw(`DROP TYPE IF EXISTS ${e}`);
  }
}
