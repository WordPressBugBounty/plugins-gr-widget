<?php

defined('ABSPATH') || exit;

if (! defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

$grwi_options = [
    'grwi_site_id',
    'grwi_site_secret',
    'grwi_api_token',
    'grwi_linked',
    'grwi_capabilities',
    'grwi_capabilities_refreshed_at',
    'grwi_embed_script_url',
    'grwi_api_base_url',
    'grwi_linked_account',
    'grwi_plugin_version',
    'grwi_last_failed_api_url',
    'grwi_remembered_places',
    'grwi_hidden_recent_place_ids',
    'grwi_wp_review_prompt',
    'grwi_service_consent',
    'grwi_legacy_authorization',
];

foreach ($grwi_options as $grwi_option) {
    delete_option($grwi_option);
}

$grwi_legacy_options = [
    'grw_site_id',
    'grw_site_secret',
    'grw_api_token',
    'grw_linked',
    'grw_capabilities',
    'grw_capabilities_refreshed_at',
    'grw_embed_script_url',
    'grw_api_base_url',
    'grw_linked_account',
    'grw_plugin_version',
    'grw_last_failed_api_url',
];

foreach ($grwi_legacy_options as $grwi_option) {
    delete_option($grwi_option);
}

wp_clear_scheduled_hook('grwi_refresh_capabilities');
wp_clear_scheduled_hook('grw_refresh_capabilities');

