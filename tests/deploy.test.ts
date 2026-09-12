import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('../scripts/deploy-cpanel.sh', import.meta.url));
const config = {
  CPANEL_HOST: 'cpanel.example.com',
  CPANEL_PORT: '22',
  CPANEL_USERNAME: 'animal_rescue_test',
  CPANEL_DEPLOY_PATH: '/app.teinum.no/london-animal-rescue',
  CPANEL_SSH_KEY: 'test-only-placeholder',
  CPANEL_SSH_KNOWN_HOSTS: 'test-only-placeholder',
  CPANEL_PASSWORD: '',
};
function run(extra: NodeJS.ProcessEnv, dist = '/nonexistent-london-animal-rescue-build') {
  return spawnSync('bash', [script, dist], {
    env: { ...process.env, ...config, ...extra },
    encoding: 'utf8',
    timeout: 20000,
  });
}
test('deployment rejects missing credentials, panel port and unsafe destination paths', () => {
  for (const extra of [
    { CPANEL_HOST: '' },
    { CPANEL_SSH_KEY: '' },
    { CPANEL_USERNAME: '' },
    { CPANEL_PORT: '2083' },
    { CPANEL_PORT: '65536' },
    { CPANEL_HOST: 'host;echo bad' },
    { CPANEL_DEPLOY_PATH: '/home/animal_rescue_test/public_html' },
    { CPANEL_DEPLOY_PATH: '/home/animal_rescue_test/../london-animal-rescue' },
    { CPANEL_DEPLOY_PATH: '/home/animal_rescue_test/london-animal-rescue;echo bad' },
  ]) {
    const result = run(extra);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Deployment error:/);
    assert.doesNotMatch(result.stdout + result.stderr, /test-only-placeholder/);
  }
});
test('deployment rejects builds with the wrong asset base', () => {
  const dir = mkdtempSync(join(tmpdir(), 'animal_rescue-deploy-build-'));
  try {
    mkdirSync(join(dir, 'assets'));
    mkdirSync(join(dir, 'data'));
    completeBuild(dir);
    writeFileSync(join(dir, 'index.html'), '<script src="/assets/index.js"></script>');

    const result = run({}, dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /BASE_PATH=\/london-animal-rescue\//);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('encrypted-key deployment uploads assets before publishing index and cleans credentials', () => {
  const dir = mkdtempSync(join(tmpdir(), 'animal_rescue-deploy-transport-'));
  try {
    const key = join(dir, 'test-key'),
      dist = join(dir, 'dist'),
      bin = join(dir, 'bin'),
      log = join(dir, 'commands');
    mkdirSync(bin);
    mkdirSync(join(dist, 'assets'), { recursive: true });
    mkdirSync(join(dist, 'data'));
    completeBuild(dist);
    writeFileSync(
      join(dist, 'index.html'),
      '<script src="/london-animal-rescue/assets/index.js"></script>',
    );

    const generated = spawnSync(
      'ssh-keygen',
      ['-q', '-t', 'ed25519', '-N', 'animal_rescue-test-passphrase', '-f', key],
      { encoding: 'utf8' },
    );
    assert.equal(generated.status, 0, generated.stderr);
    // Only remote transport is stubbed. Key loading and cleanup use real OpenSSH.
    for (const command of ['ssh', 'rsync']) {
      writeFileSync(
        join(bin, command),
        `#!/usr/bin/env bash\nprintf '%s\\n' '${command}' "$@" >> "$LONDON_ANIMAL_RESCUE_TEST_LOG"\nprintf 'config=%s\\n' "$LONDON_ANIMAL_RESCUE_SSH_CONFIG" >> "$LONDON_ANIMAL_RESCUE_TEST_LOG"\nif [[ '${command}' == ssh && "$*" == *LONDON_ANIMAL_RESCUE_RESOLVE_PARENT* ]]; then printf '%s\\n' "$LONDON_ANIMAL_RESCUE_TEST_RESOLVED_PARENT"; fi\n`,
        { mode: 0o755 },
      );
    }
    const secret = readFileSync(key, 'utf8');
    const result = run(
      {
        PATH: `${bin}:${process.env.PATH}`,
        LONDON_ANIMAL_RESCUE_TEST_LOG: log,
        LONDON_ANIMAL_RESCUE_TEST_RESOLVED_PARENT: '/home/web6178/app.teinum.no',
        CPANEL_SSH_KEY: secret,
        CPANEL_PASSWORD: 'animal_rescue-test-passphrase',
        CPANEL_SSH_KNOWN_HOSTS: `cpanel.example.com ${readFileSync(`${key}.pub`, 'utf8')}`,
      },
      dist,
    );
    assert.equal(result.status, 0, result.stderr);
    const commands = readFileSync(log, 'utf8');
    assert.ok(commands.indexOf('--exclude=/index.html') < commands.indexOf(`${dist}/index.html`));
    assert.ok(commands.indexOf(`${dist}/index.html`) < commands.indexOf('mv -f --'));
    assert.doesNotMatch(commands, /--delete/);
    assert.ok(
      commands.includes(
        'london-animal-rescue-deploy:/home/web6178/app.teinum.no/london-animal-rescue/',
      ),
    );
    assert.doesNotMatch(
      result.stdout + result.stderr + commands,
      /PRIVATE KEY|animal_rescue-test-passphrase/,
    );
    const configPath = commands.match(/^config=(.+)$/m)?.[1];
    assert.ok(configPath);
    assert.equal(existsSync(configPath), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function completeBuild(dir: string) {
  mkdirSync(join(dir, 'map'));
  mkdirSync(join(dir, 'art'));
  writeFileSync(join(dir, '.htaccess'), '# compression');
  writeFileSync(join(dir, 'assets/maplibre-gl-worker-test.js'), '// test worker');
  writeFileSync(
    join(dir, 'data/incidents.json'),
    JSON.stringify({ version: 1, records: [{ id: 'test-only' }], metadata: { total: 1 } }),
  );
  writeFileSync(join(dir, 'data/provenance.json'), '{}');
  writeFileSync(join(dir, 'data/source.csv'), 'test-only');
  writeFileSync(join(dir, 'map/provenance.json'), '{}');
  for (const name of ['base', 'buildings', 'labels'])
    writeFileSync(
      join(dir, `map/${name}.geojson`),
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } },
        ],
      }),
    );
  for (const name of [
    'helmet',
    'cat',
    'cat-card',
    'dog',
    'dog-card',
    'bird',
    'bird-card',
    'fox',
    'fox-card',
    'paw',
    'paw-card',
  ])
    writeFileSync(join(dir, `art/${name}.svg`), '<svg/>');
}
