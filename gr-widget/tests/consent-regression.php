<?php
/** Standalone regression harness: php tests/consent-regression.php (no service calls). */
error_reporting(E_ALL);
set_error_handler(static function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});
define('ABSPATH', __DIR__ . '/');
define('GRWI_VERSION', '1.2.6');
define('GRWI_API_BASE', 'https://grwidget.com/api/v1');
define('GRWI_EMBED_SCRIPT', 'https://grwidget.com/v1/grwidget.js');
define('GRWI_PLUGIN_DIR', dirname(__DIR__) . '/');
define('GRWI_PLUGIN_FILE', GRWI_PLUGIN_DIR . 'gr-widget.php');
define('HOUR_IN_SECONDS', 3600);
$options = $requests = $scripts = $cron = $hooks = [];
$admin = false;
$can_manage = true;
$screen_id = 'dashboard';
$nonce_valid = true;
$checks = 0;
class WP_Error {
    private $code; private $message; private $data;
    public function __construct($code, $message = '', $data = null) { $this->code = $code; $this->message = $message; $this->data = $data; }
    public function get_error_code() { return $this->code; }
    public function get_error_message() { return $this->message; }
    public function get_error_data() { return $this->data; }
}
class TestRedirect extends RuntimeException {}
class TestNonceFailure extends RuntimeException {}
class LocalPosts {
    public $posts = 'wp_posts'; public $postmeta = 'wp_postmeta'; public $rows = []; public $metaRows = []; public $queries = 0;
    public function esc_like($value) { return addcslashes($value, '_%\\'); }
    public function prepare($sql, $args) { return [$sql, $args]; }
    public function get_results($query) {
        ++$this->queries;
        check(strpos($query[0], "post_type <> 'revision'") !== false, 'revisions excluded');
        if (strpos($query[0], 'wp_postmeta') !== false) return $this->metaRows;
        $rows = [];
        foreach ($this->rows as $i => $row) {
            if ($i + 1 > $query[1] && in_array($row['status'], ['publish','private','future','draft','pending'], true) && $row['type'] !== 'revision') {
                $rows[] = (object) ['ID' => $i + 1, 'post_content' => $row['content']];
            }
        }
        return array_slice($rows, 0, 20);
    }

}
$wpdb = new LocalPosts();
function check($condition, $message) { global $checks; ++$checks; if (! $condition) { throw new RuntimeException($message); } }
function same($expected, $actual, $message) { check($expected === $actual, $message . ': ' . var_export($actual, true)); }
function get_option($key, $default = false) { global $options; return array_key_exists($key, $options) ? $options[$key] : $default; }
function update_option($key, $value, $autoload = null) { global $options; $options[$key] = $value; return true; }
function add_option($key, $value, $deprecated = '', $autoload = null) { global $options; if (array_key_exists($key, $options)) return false; $options[$key] = $value; return true; }
function delete_option($key) { global $options; unset($options[$key]); return true; }
function __($value, $domain = '') { return $value; }
function esc_html__($value, $domain = '') { return esc_html($value); }
function esc_html_e($value, $domain = '') { echo esc_html($value); }
function esc_html($value) { return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8'); }
function esc_attr($value) { return esc_html($value); }
function esc_url($value) { return $value; }
function esc_url_raw($value) { return $value; }
function sanitize_text_field($value) { return trim(strip_tags((string) $value)); }
function sanitize_key($value) { return preg_replace('/[^a-z0-9_-]/', '', strtolower($value)); }
function wp_unslash($value) { return $value; }
function wp_parse_url($url, $component = -1) { return parse_url($url, $component); }
function home_url($path = '') { return 'https://customer.example' . $path; }
function admin_url($path = '') { return 'https://customer.example/wp-admin/' . $path; }
function wp_json_encode($data) { return json_encode($data); }
function is_serialized($value) { return is_string($value) && preg_match('/^(?:a|s|i|b|O):/', $value); }
function is_wp_error($value) { return $value instanceof WP_Error; }
function is_admin() { global $admin; return $admin; }
function is_singular() { return false; }
function current_user_can($capability) { global $can_manage; return $can_manage; }
function get_current_screen() { global $screen_id; return (object) ['id' => $screen_id]; }
function shortcode_atts($defaults, $atts, $tag = '') { return array_merge($defaults, $atts); }
function wp_enqueue_script($handle, $src, $deps = [], $version = false, $footer = false) { global $scripts; $scripts[$handle] = $src; }
function wp_script_is($handle, $state) { global $scripts; return isset($scripts[$handle]); }
function add_action($hook, $callback, ...$args) { global $hooks; $hooks[$hook][] = $callback; }
function add_filter($hook, $callback, ...$args) { add_action($hook, $callback); }
function add_shortcode($tag, $callback) { add_action('shortcode:' . $tag, $callback); }
function register_activation_hook($file, $callback) {}
function wp_next_scheduled($hook) { global $cron; return $cron[$hook]['time'] ?? false; }
function wp_schedule_event($time, $interval, $hook) { global $cron; $cron[$hook] = ['time' => $time, 'interval' => $interval]; }
function wp_clear_scheduled_hook($hook) { global $cron; unset($cron[$hook]); }
function wp_remote_head($url, $args) { global $requests; $requests[] = [$url, $args]; return ['response' => ['code' => 200], 'body' => '{}']; }
function wp_remote_request($url, $args) {
    global $requests;
    $requests[] = [$url, $args];
    check($args['redirection'] === 0, 'credentials cannot follow redirects');
    if (strpos($url, '/widgets') !== false) $body = ['widgets' => [['embed_key' => 'grw_existing-key', 'name' => 'Saved reviews']]];
    elseif (strpos($url, '/account') !== false) $body = ['id' => 81, 'name' => 'Existing owner'];
    else $body = ['plan' => 'wordpress', 'limits' => ['max_widgets' => 1]];
    return ['response' => ['code' => 200], 'body' => json_encode($body)];
}
function wp_remote_retrieve_response_code($response) { return $response['response']['code']; }
function wp_remote_retrieve_body($response) { return $response['body']; }
function wp_nonce_field($action) { echo '<input name="_wpnonce" value="test-nonce" />'; }
function check_admin_referer($action) { global $nonce_valid; if (! $nonce_valid) throw new TestNonceFailure(); }
function submit_button($label) { echo '<button>' . esc_html($label) . '</button>'; }
function wp_safe_redirect($url) { throw new TestRedirect($url); }
function reset_site(array $data = [], array $contents = []) {
    global $options, $requests, $scripts, $cron, $wpdb, $admin, $can_manage, $screen_id, $nonce_valid;
    $options = $data; $requests = $scripts = $cron = []; $admin = false; $can_manage = true; $screen_id = 'dashboard'; $nonce_valid = true;
    $wpdb->rows = array_map(static function ($content) { return ['content' => $content, 'status' => 'publish', 'type' => 'page']; }, $contents);
    $wpdb->queries = 0; $wpdb->metaRows = [];
    $_POST = $_GET = [];
    foreach (['needed', 'hosted_script_in_document'] as $property) {
        $reflection = new ReflectionProperty(GRWI_Embed::class, $property);
        $reflection->setAccessible(true); $reflection->setValue(null, false);
    }
}
function output(callable $render) { ob_start(); $render(); return ob_get_clean(); }
$source = getenv('GRWI_SOURCE_DIR') ?: dirname(__DIR__);
require_once GRWI_PLUGIN_DIR . 'includes/class-grwi-config.php';
require_once $source . '/includes/class-grwi-api-client.php';
require_once $source . '/includes/class-grwi-shortcode.php';
require_once (file_exists($source . '/includes/class-grwi-embed.php') ? $source : GRWI_PLUGIN_DIR) . '/includes/class-grwi-embed.php';
require_once GRWI_PLUGIN_DIR . 'includes/class-grwi-plugin.php';
require_once GRWI_PLUGIN_DIR . 'includes/class-grwi-blocks.php';
require_once GRWI_PLUGIN_DIR . 'includes/class-grwi-admin.php';
$credentials = ['grwi_site_id' => 431, 'grwi_site_secret' => 'existing-secret'];
$linked = $credentials + ['grwi_linked' => 1, 'grwi_api_token' => 'grw_existing-token', 'grwi_linked_account' => ['id' => 81, 'name' => 'Existing owner']];
$business = $credentials + ['grwi_remembered_places' => [['place_id' => 'ChIJ-existing-business', 'business_name' => 'Existing business', 'rating' => 4.8, 'review_count' => 127]]];
$container = '<div class="grwidget-embed" data-grwidget-key="grw_existing-key" data-grwidget-locale="en_US"></div>';
if (getenv('GRWI_SMOKE')) {
    reset_site($linked + ['grwi_plugin_version' => '1.2.4']);
    $html = GRWI_Shortcode::render(['id' => 'grw_existing-key']);
    echo ($html === $container ? 'RENDERS' : 'HIDDEN') . "\n";
    exit;
}
foreach (['1.2.4', '1.2.5'] as $version) {
    foreach (['linked' => $linked, 'anonymous' => $business, 'shortcode' => $credentials] as $kind => $data) {
        reset_site($data + ['grwi_plugin_version' => $version], $kind === 'shortcode' ? ['[grwi_widget id="grw_existing-key"]'] : []);
        $before = $options;
        same(true, GRWI_API_Client::service_allowed(), "$version $kind recovers");
        same([], $requests, 'eligibility makes zero external requests');
        same($container, GRWI_Shortcode::render(['id' => 'grw_existing-key']), 'original shortcode container');
        same($container, GRWI_Blocks::render(['embedKey' => 'grw_existing-key']), 'original block container');
        same(GRWI_EMBED_SCRIPT, $scripts['grwi-embed'] ?? '', 'hosted script enqueued');
        check(strpos(GRWI_Embed::filter_embed_tag('', 'grwi-embed'), wp_json_encode(GRWI_EMBED_SCRIPT)) !== false, 'hosted loader emitted');
        $client = new GRWI_API_Client();
        same(true, $client->ensure_registered(false), 'existing registration reused');
        $widgets = $client->get_widgets();
        same('grw_existing-key', $widgets['widgets'][0]['embed_key'], 'API widgets retain keys');
        $cron['grwi_refresh_capabilities'] = ['time' => 1900000000, 'interval' => 'twicedaily'];
        GRWI_Plugin::instance()->init_components();
        same(1900000000, $cron['grwi_refresh_capabilities']['time'], 'existing schedule preserved');
        unset($cron['grwi_refresh_capabilities']);
        GRWI_Plugin::instance()->init_components();
        same('twicedaily', $cron['grwi_refresh_capabilities']['interval'], '1.2.5 removed schedule restored');
        GRWI_Plugin::instance()->cron_refresh_capabilities();
        check(get_option('grwi_capabilities_refreshed_at', 0) > 0, 'successful background refresh');
        foreach ($before as $key => $value) {
            if ($key !== 'grwi_plugin_version') same($value, get_option($key), 'customer data preserved: ' . $key);
        }
        same(null, get_option('grwi_service_consent', null), 'does not manufacture consent');
        $admin = true;
        same('', output([GRWI_Admin::class, 'connection_notice']), 'restored users see no warning');
        foreach ($requests as [$url, $args]) check(strpos($url, '/register') === false, 'does not re-register');
    }
}
foreach ([[], ['grwi_plugin_version' => '1.2.5'], ['grwi_plugin_version' => '1.2.6'], $credentials, $credentials + ['grwi_capabilities' => ['plan' => 'wordpress']]] as $data) {
    reset_site($data);
    same(false, GRWI_API_Client::service_allowed(), 'fresh/automatic registration requires consent');
    $client = new GRWI_API_Client();
    same(false, $client->ensure_registered(false), 'cannot auto-register');
    same('', GRWI_Shortcode::render(['id' => 'grw_existing-key']), 'unconsented shortcode hidden');
    same('', GRWI_Blocks::render(['embedKey' => 'grw_existing-key']), 'unconsented block hidden');
    GRWI_Embed::rendered_content($container);
    same([], $scripts, 'no external embed');
    $client->get_widgets(); $client->refresh_capabilities();
    GRWI_Plugin::instance()->init_components();
    GRWI_Plugin::instance()->activate();
    same([], $requests, 'no network before consent, including activation');
    same([], $cron, 'no unconsented cron');
    $options += $linked;
    same(false, GRWI_API_Client::service_allowed(), 'later configuration cannot manufacture legacy status');
}
foreach ([false, 0, '0', ''] as $refusal) {
    reset_site($linked + ['grwi_service_consent' => $refusal]);
    same(false, GRWI_API_Client::service_allowed(), 'explicit refusal beats legacy evidence');
    same('', GRWI_Shortcode::render(['id' => 'grw_existing-key']), 'refused widget hidden');
    same([], $requests, 'refusal makes no network requests');
}
reset_site($linked);
same(true, GRWI_API_Client::service_allowed(), 'legacy restored');
update_option('grwi_service_consent', false);
same(false, GRWI_API_Client::service_allowed(), 'later revocation overrides recorded legacy recovery');
same('', GRWI_Embed::filter_embed_tag('', 'grwi-embed'), 'revocation blocks queued loader');
reset_site(['grwi_service_consent' => 1]);
same(true, GRWI_API_Client::service_allowed(), 'explicit consent accepted');
delete_option('grwi_service_consent'); $options += $linked;
same(false, GRWI_API_Client::service_allowed(), 'deleting consent cannot trigger legacy detection');
foreach (['[grw-widget id="grw_existing-key"]', '[grwi_widget id=grw_existing-key]', '<!-- wp:grwi-widget/embed {"embedKey":"grw_existing-key"} /-->', '<!-- wp:gr-widget/embed {"embedKey":"grw_existing-key"} /-->', $container] as $content) {
    reset_site($credentials, [$content]);
    same(true, GRWI_API_Client::service_allowed(), 'saved legacy embed recognised: ' . $content);
    same(1, $wpdb->queries, 'content inspected once');
    GRWI_API_Client::service_allowed(); same(1, $wpdb->queries, 'no repeated content scans');
}
foreach (['[grwi_widget id=""]', '[[grwi_widget id="grw_existing-key"]]', '<!-- wp:grwi-widget/embed {"embedKey":""} /-->'] as $content) {
    reset_site($credentials, [$content]);
    same(false, GRWI_API_Client::service_allowed(), 'empty/escaped embed is insufficient');
}
reset_site($credentials);
$wpdb->rows = [['content' => '[grwi_widget id="grw_existing-key"]', 'status' => 'trash', 'type' => 'page']];
same(false, GRWI_API_Client::service_allowed(), 'trash excluded');
reset_site($credentials + ['widget_custom_html' => [2 => ['content' => $container], '_multiwidget' => 1]]);
same(true, GRWI_API_Client::service_allowed(), 'saved classic widget configuration');
same($container, GRWI_Embed::rendered_content($container), 'classic HTML container unchanged');
same(GRWI_EMBED_SCRIPT, $scripts['grwi-embed'] ?? '', 'rendered classic embed loads hosted script');
reset_site($linked + ['grwi_service_consent' => 1]);
$client = new GRWI_API_Client();
same(true, $client->is_linked(), 'explicitly consented account stays linked');
same($container, GRWI_Shortcode::render(['id' => 'grw_existing-key']), 'explicitly consented widget renders');
same('grw_existing-key', $client->get_widgets()['widgets'][0]['embed_key'], 'explicitly consented account API works');
reset_site($linked + ['grwi_service_consent' => false]);
$cron['grwi_refresh_capabilities'] = ['time' => 1900000000, 'interval' => 'twicedaily'];
GRWI_Plugin::instance()->init_components();
GRWI_Plugin::instance()->cron_refresh_capabilities();
same([], $cron, 'revocation removes refresh schedule');
same([], $requests, 'revoked cron makes no network requests');
reset_site($credentials + ['grwi_remembered_places' => [['place_id' => '', 'business_name' => '']]]);
same(false, GRWI_API_Client::service_allowed(), 'malformed configuration cannot grant authorisation');
reset_site(['grwi_linked' => 1, 'grwi_api_token' => '']);
same(false, GRWI_API_Client::service_allowed(), 'link flag without token is insufficient');
$builderFixtures = [
    ['_elementor_data', json_encode([['elType'=>'container','elements'=>[['elType'=>'widget','widgetType'=>'shortcode','settings'=>['shortcode'=>'[grwi_widget id="grw_existing-key"]']]]]])],
    ['_elementor_data', json_encode([['elType'=>'widget','widgetType'=>'html','settings'=>['html'=>$container]]])],
    ['_bricks_page_content_2', serialize([['id'=>'abc123','name'=>'shortcode','settings'=>['shortcode'=>'[grwi_widget id="grw_existing-key"]']]])],
];
foreach ($builderFixtures as [$metaKey, $metaValue]) {
    reset_site($credentials + ['grwi_plugin_version'=>'1.2.5']);
    $wpdb->metaRows=[(object)['meta_id'=>1,'meta_key'=>$metaKey,'meta_value'=>$metaValue]];
    same(true, GRWI_API_Client::service_allowed(), 'documented builder placement recovers');
    same($container, GRWI_Shortcode::render(['id'=>'grw_existing-key']), 'builder key renders unchanged');
}
foreach (['<pre>[grwi_widget id="grw_existing-key"]</pre>', '<div class="grwidget-embed"></div><div data-grwidget-key="grw_existing-key" data-grwidget-locale="en_US"></div>', '<!-- [grwi_widget id="grw_existing-key"] -->'] as $example) {
    reset_site($credentials, [$example]);
    same(false, GRWI_API_Client::service_allowed(), 'non-rendering examples cannot authorise');
}
reset_site($business);
GRWI_Plugin::instance()->init_components();
same('1.2.6', get_option('grwi_plugin_version'), 'upgrade version saved');
same(true, GRWI_API_Client::service_allowed(), 'recovery survives version overwrite');
reset_site(['grw_site_id' => 431, 'grw_site_secret' => 'existing-secret', 'grw_linked' => 1, 'grw_api_token' => 'grw_existing-token']);
GRWI_Plugin::instance()->activate();
same(true, GRWI_API_Client::service_allowed(), 'pre-1.0 aliases migrated before activation decision');
reset_site($credentials);
$admin = true;
$notice = output([GRWI_Admin::class, 'connection_notice']);
check(strpos($notice, 'GR Widget needs your attention') !== false, 'recovery title');
check(strpos($notice, 'Your existing Google review widgets may not appear until you reconnect GR Widget. Your saved widgets and settings are still available.') !== false, 'requested recovery copy');
check(strpos($notice, GRWI_Admin::admin_page_url()) !== false, 'CTA opens existing setup page');
same(null, get_option('grwi_service_consent', null), 'notice cannot approve consent');
$screen_id = 'edit-post'; same('', output([GRWI_Admin::class, 'connection_notice']), 'notice limited to relevant screens');
$screen_id = 'dashboard'; $can_manage = false;
same('', output([GRWI_Admin::class, 'connection_notice']), 'non-administrators see no notice');
$can_manage = true; $admin = false;
same('', output([GRWI_Admin::class, 'connection_notice']), 'public visitors see no notice');
$admin = true;
$setup = output([GRWI_Admin::class, 'render_page']);
check(strpos($setup, 'grwi_action" value="enable_service') !== false, 'existing consent form');
check(strpos($setup, 'https://grwidget.com/privacy') !== false, 'disclosure links retained');
same([], $requests, 'recovery screen has no network requests');
$_POST = ['grwi_action' => 'enable_service'];
$nonce_valid = false;
try { GRWI_Admin::handle_actions(); } catch (TestNonceFailure $e) {}
same(null, get_option('grwi_service_consent', null), 'invalid nonce cannot connect');
$can_manage = false;
GRWI_Admin::handle_actions();
same(null, get_option('grwi_service_consent', null), 'non-administrator cannot connect');
$can_manage = true;
$nonce_valid = true;
try { GRWI_Admin::handle_actions(); } catch (TestRedirect $e) {}
same(1, get_option('grwi_service_consent'), 'valid consent submission approves');
same('existing-secret', get_option('grwi_site_secret'), 'reconnect preserves credentials');
same('', output([GRWI_Admin::class, 'connection_notice']), 'notice clears after consent');
reset_site(); $admin = true;
same('', output([GRWI_Admin::class, 'connection_notice']), 'fresh install has no misleading recovery notice');
check(strpos(output([GRWI_Admin::class, 'render_page']), 'Set up GR Widget') !== false, 'fresh setup prompt');
same('https://grwidget.com/api/v1', GRWI_API_Client::canonical_api_base('http://evil.example:8080/api/v1'), 'host restriction retained');
same('https://grwidget.com/api/v1', GRWI_API_Client::canonical_api_base('http://grwidget.com:8080/api/v1'), 'HTTPS and port restriction retained');
reset_site($credentials + ['grwi_service_consent'=>1,'grwi_capabilities'=>['limits'=>['max_widgets'=>3,'max_reviews_display'=>10,'max_reviews_sync'=>10]]]);
$anonymous_caps=(new GRWI_API_Client())->capabilities();
same(1,$anonymous_caps['limits']['max_widgets'],'stale cache cannot grant unlinked extra widgets');
same(5,$anonymous_caps['limits']['max_reviews_display'],'stale cache cannot grant unlinked extra displayed reviews');
same(5,$anonymous_caps['limits']['max_reviews_sync'],'stale cache cannot grant unlinked extra synced reviews');
echo "PASS: $checks assertions; legacy recovery, rendering, API, cron, consent safety and admin flow.\n";
