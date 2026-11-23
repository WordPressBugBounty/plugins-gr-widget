<?php
/** php tests/localization-regression.php [site|wpml|polylang|admin|invalid|ar|zh|ja|nb] — no network or WP install. */
define('ABSPATH', __DIR__.'/');
define('GRWI_VERSION', '1.2.8');
define('GRWI_EMBED_SCRIPT', 'https://grwidget.com/v1/grwidget.js');
$mode = $argv[1] ?? 'site';
function is_admin() { return in_array($GLOBALS['mode'], ['admin','admin_wpml'], true); }
function get_locale() { return ['admin'=>'de_DE','ar'=>'ar_SA','zh'=>'zh_CN','ja'=>'ja','nb'=>'nb_NO'][$GLOBALS['mode']] ?? 'nl_BE'; }
function get_option($key, $default = null) { return $key === 'WPLANG' ? 'nl_NL' : $default; }
function apply_filters($hook, $value) { if ($hook === 'wpml_current_language' && in_array($GLOBALS['mode'], ['wpml','wpml_other','wpml_full','wpml_all','admin_wpml'], true)) return ['admin_wpml'=>'fr','wpml'=>'nl','wpml_other'=>'fr','wpml_full'=>'nl_NL','wpml_all'=>'all'][$GLOBALS['mode']]; if ($hook === 'grwi_widget_frontend_locale' && $GLOBALS['mode'] === 'invalid') return '\"><script>'; return $value; }
if ($mode === 'polylang') { function pll_current_language($format) { if ($format !== 'locale') throw new RuntimeException('Expected page locale'); return 'nl_NL'; } }
function shortcode_atts($defaults, $atts) { return array_merge($defaults, $atts); }
function sanitize_text_field($value) { return strip_tags($value); }
function esc_attr($value) { return htmlspecialchars($value, ENT_QUOTES, 'UTF-8'); }
function esc_url($value) { return $value; }
function is_singular() { return false; }
function wp_script_is($handle, $state) { return false; }
function wp_enqueue_script(...$args) { $GLOBALS['enqueued'][] = $args; }
class GRWI_API_Client { public static function service_allowed() { return true; } }
require dirname(__DIR__).'/includes/class-grwi-embed.php';
require dirname(__DIR__).'/includes/class-grwi-shortcode.php';
require dirname(__DIR__).'/includes/class-grwi-blocks.php';
$expected = ['site'=>'nl_BE','wpml'=>'nl_BE','wpml_other'=>'fr','wpml_full'=>'nl_NL','wpml_all'=>'nl_BE','polylang'=>'nl_NL','admin'=>'nl_NL','admin_wpml'=>'nl_NL','invalid'=>'en_US','ar'=>'ar_SA','zh'=>'zh_CN','ja'=>'ja','nb'=>'nb_NO'][$mode];
if (GRWI_Embed::frontend_locale() !== $expected) throw new RuntimeException('Wrong frontend locale: '.$mode);
$html = GRWI_Shortcode::render(['id'=>'original-key']);
if (strpos($html, 'data-grwidget-locale="'.$expected.'"') === false || strpos($html, 'data-grwidget-key="original-key"') === false) throw new RuntimeException('Shortcode lost locale or key');
if (GRWI_Blocks::render(['embedKey'=>'original-key']) !== $html) throw new RuntimeException('Block/shortcode parity failed');
echo 'PASS: '.$mode.' locale, shortcode/block parity and safe escaping'.PHP_EOL;
