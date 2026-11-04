<?php

defined('ABSPATH') || exit;

/**
 * Bootstrap hooks for GR Widget.
 */
final class GRWI_Plugin
{
    private static ?self $instance = null;

    public static function instance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    private function __construct()
    {
        $this->includes();
        $this->hooks();
    }

    private function includes(): void
    {
        require_once GRWI_PLUGIN_DIR . 'includes/class-grwi-api-client.php';
        require_once GRWI_PLUGIN_DIR . 'includes/class-grwi-upgrade.php';
        require_once GRWI_PLUGIN_DIR . 'includes/class-grwi-embed.php';
        require_once GRWI_PLUGIN_DIR . 'includes/class-grwi-shortcode.php';
        require_once GRWI_PLUGIN_DIR . 'includes/class-grwi-blocks.php';
        require_once GRWI_PLUGIN_DIR . 'includes/class-grwi-admin.php';
        require_once GRWI_PLUGIN_DIR . 'includes/class-grwi-customize.php';
    }

    private function hooks(): void
    {
        register_activation_hook(GRWI_PLUGIN_FILE, [$this, 'activate']);
        add_action('init', [$this, 'init_components']);
        add_action('grwi_refresh_capabilities', [$this, 'cron_refresh_capabilities']);
    }

    public function init_components(): void
    {
        self::maybe_upgrade_plugin();

        GRWI_API_Client::migrate_stored_api_base();

        if (! wp_next_scheduled('grwi_refresh_capabilities')) {
            wp_schedule_event(time() + HOUR_IN_SECONDS, 'twicedaily', 'grwi_refresh_capabilities');
        }

        GRWI_Embed::register();
        GRWI_Shortcode::register();
        GRWI_Blocks::register();
        GRWI_Admin::register();
        GRWI_Customize::register();
        GRWI_Upgrade::register();
    }

    public function activate(): void
    {
        $client = new GRWI_API_Client();
        $client->ensure_registered();

        if (! wp_next_scheduled('grwi_refresh_capabilities')) {
            wp_schedule_event(time() + HOUR_IN_SECONDS, 'twicedaily', 'grwi_refresh_capabilities');
        }
    }

    public function cron_refresh_capabilities(): void
    {
        $client = new GRWI_API_Client();
        $client->refresh_capabilities();
    }

    /**
     * Reset stale API options after plugin updates (fixes cached 404 bases/paths).
     */
    private static function maybe_upgrade_plugin(): void
    {
        self::migrate_legacy_options();

        $stored_version = (string) get_option('grwi_plugin_version', '');
        if ($stored_version === GRWI_VERSION) {
            return;
        }

        update_option('grwi_api_base_url', GRWI_API_BASE, false);
        delete_option('grwi_last_failed_api_url');
        if ($stored_version !== '' && version_compare($stored_version, '1.0.3', '<')) {
            delete_option('grwi_site_secret');
        }
        update_option('grwi_plugin_version', GRWI_VERSION, false);
    }

    /**
     * Copy pre-1.0.0 grw_* options and cron hooks to grwi_* identifiers.
     */
    private static function migrate_legacy_options(): void
    {
        $option_map = [
            'grw_site_id' => 'grwi_site_id',
            'grw_site_secret' => 'grwi_site_secret',
            'grw_api_token' => 'grwi_api_token',
            'grw_linked' => 'grwi_linked',
            'grw_capabilities' => 'grwi_capabilities',
            'grw_capabilities_refreshed_at' => 'grwi_capabilities_refreshed_at',
            'grw_embed_script_url' => 'grwi_embed_script_url',
            'grw_api_base_url' => 'grwi_api_base_url',
            'grw_linked_account' => 'grwi_linked_account',
            'grw_plugin_version' => 'grwi_plugin_version',
            'grw_last_failed_api_url' => 'grwi_last_failed_api_url',
        ];

        foreach ($option_map as $legacy_key => $new_key) {
            $legacy_value = get_option($legacy_key, null);
            if ($legacy_value === null) {
                continue;
            }

            if (get_option($new_key, null) === null) {
                update_option($new_key, $legacy_value, false);
            }

            delete_option($legacy_key);
        }

        if (wp_next_scheduled('grw_refresh_capabilities')) {
            $timestamp = wp_next_scheduled('grw_refresh_capabilities');
            if ($timestamp) {
                wp_clear_scheduled_hook('grw_refresh_capabilities');
                if (! wp_next_scheduled('grwi_refresh_capabilities')) {
                    wp_schedule_event($timestamp, 'twicedaily', 'grwi_refresh_capabilities');
                }
            }
        }
    }

}
