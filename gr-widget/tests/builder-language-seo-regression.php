<?php
/** Offline native-tab and save-boundary regression test. */
define('ABSPATH', __DIR__.'/');
define('GRWI_VERSION', '1.2.7');
define('GRWI_PLUGIN_URL', 'https://native.test/wp-content/plugins/gr-widget/');
function esc_url($url) { return htmlspecialchars($url, ENT_QUOTES, 'UTF-8'); }
function __($text, $domain = '') { return $text; }
function sanitize_key($key) { return preg_replace('/[^a-z0-9_-]/', '', strtolower($key)); }
function sanitize_text_field($text) { return strip_tags((string) $text); }
function sanitize_textarea_field($text) { return strip_tags((string) $text); }
function is_wp_error($value) { return $value instanceof WP_Error; }
class WP_Error { public function __construct(...$args) {} }
require dirname(__DIR__).'/includes/class-grwi-customize.php';
require dirname(__DIR__).'/includes/class-grwi-config.php';
$count = 0;
function check($condition, $message) { global $count; ++$count; if (!$condition) throw new RuntimeException($message); }
foreach ([true, false] as $locked) {
 $builder=['sections'=>[['id'=>'settings'],['id'=>'customize'],['id'=>'install']], 'fields'=>[['key'=>'enable_json_ld','type'=>'checkbox','section'=>'settings','group'=>'json_ld','locked'=>$locked,'upgrade_feature'=>'json_ld']]];
 $result=GRWI_Customize::language_seo_tabs($builder);
 check(array_column($result['sections'],'id')===['customize','language','seo','install'],'Dedicated ordered tabs');
 check($result['fields'][0]['section']==='seo','No Structured Data field left in Settings');
 check($result['sections'][2]['locked']===$locked,'Business entitlement preserved');
 $language=array_values(array_filter($result['fields'],static function($f){return $f['key']==='language';}))[0];
 check(count($language['options'])===22,'Automatic plus 21 languages');
 check(GRWI_Customize::language_seo_tabs($result)===$result,'Repeated refresh is idempotent');
}
$missing=GRWI_Customize::language_seo_tabs([]);
check($missing['sections'][1]['locked']===true,'Missing entitlement never grants SEO');
foreach (['en','nl','ar','zh','ja','nb','el'] as $code) {
 $clean=GRWI_Config::sanitize(['language'=>$code,'language_mode'=>'fixed','ai_summary_language_override'=>$code,'enable_json_ld'=>false]);
 check(!is_wp_error($clean) && $clean['language']===$code && $clean['language_mode']==='fixed' && $clean['ai_summary_language_override']===$code,'Language and AI override survive the save boundary');
}
check(is_wp_error(GRWI_Config::sanitize(['ai_summary_language_override'=>'invented'])),'Invalid language rejected');
check(is_wp_error(GRWI_Config::sanitize(['language_mode'=>'invented'])),'Invalid mode rejected');
$css=GRWI_Config::sanitize(['custom_css'=>'.grw-widget { border-radius: 12px; }']);
check(!is_wp_error($css) && strpos($css['custom_css'],'12px')!==false,'Validated CSS survives the native save boundary');
check(is_wp_error(GRWI_Config::sanitize(['custom_css'=>'@import "https://invalid.example/style.css";'])),'Remote CSS imports rejected');
check(is_wp_error(GRWI_Config::sanitize(['custom_js'=>'alert(1)'])),'JavaScript remains forbidden');
check(is_wp_error(GRWI_Config::sanitize(['custom_php'=>'echo 1;'])),'PHP remains forbidden');
check(strpos(GRWI_Customize::preview_script_tag('<script src="preview.js"></script>', 'grwi-preview'), 'data-grw-i18n-base="'.GRWI_PLUGIN_URL.'assets/i18n/"')!==false,'Bundled preview resolves local translation files');
check(GRWI_Customize::preview_script_tag('<script src="other.js"></script>', 'other')==='<script src="other.js"></script>','Other scripts are unchanged');
foreach (['review_request_avatar_count'=>4, 'slider_pagination_size'=>12, 'ai_summary_review_count'=>0] as $key=>$value) {
 check(!is_wp_error(GRWI_Config::sanitize([$key=>$value])), 'Integer defaults are writable: '.$key);
 check(is_wp_error(GRWI_Config::sanitize([$key=>'1.5'])), 'Integer settings reject fractions: '.$key);
 check(is_wp_error(GRWI_Config::sanitize([$key=>100000001])), 'Integer settings retain bounds: '.$key);
}
foreach (['spacing_padding_x','spacing_padding_y','spacing_gap','spacing_section_gap'] as $key) {
 check(!is_wp_error(GRWI_Config::sanitize([$key=>'6px'])), 'Valid legacy pixel spacing survives: '.$key);
 check(!is_wp_error(GRWI_Config::sanitize([$key=>'10px'])), 'Valid current pixel spacing survives: '.$key);
 check(is_wp_error(GRWI_Config::sanitize([$key=>'49px'])), 'Spacing retains the web size bound: '.$key);
}
echo 'PASS: '.$count.' native language/SEO and saved-setting assertions'.PHP_EOL;
