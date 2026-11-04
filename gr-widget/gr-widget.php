<?php
/**
 * Plugin Name:       GR Widget – Google Reviews Widget
 * Plugin URI:        https://grwidget.com/blog/wordpress
 * Description:       Embed Google reviews with a shortcode or block. 34 layouts, no API keys. Link a free account for 22 of them.
 * Version:           1.2.3
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            GR Widget
 * Author URI:        https://grwidget.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       gr-widget
 * Domain Path:       /languages
 */

defined('ABSPATH') || exit;

define('GRWI_VERSION', '1.2.3');
define('GRWI_PLUGIN_FILE', __FILE__);
define('GRWI_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('GRWI_PLUGIN_URL', plugin_dir_url(__FILE__));
define('GRWI_API_BASE', 'https://grwidget.com/api/v1');
define('GRWI_EMBED_SCRIPT', 'https://grwidget.com/v1/grwidget.js');

require_once GRWI_PLUGIN_DIR . 'includes/class-grwi-plugin.php';

GRWI_Plugin::instance();
