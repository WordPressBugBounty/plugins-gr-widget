<?php

defined('ABSPATH') || exit;

class GRWI_Blocks
{
    public static function register(): void
    {
        if (! function_exists('register_block_type')) {
            return;
        }

        add_action('init', [self::class, 'register_block']);
        add_action('enqueue_block_editor_assets', [self::class, 'editor_assets']);
    }

    public static function register_block(): void
    {
        register_block_type('grwi-widget/embed', [
            'api_version' => 2,
            'title' => __('GR Widget', 'gr-widget'),
            'description' => __('Embed a Google review widget from GRWidget.com.', 'gr-widget'),
            'category' => 'embed',
            'icon' => 'star-filled',
            'attributes' => [
                'embedKey' => [
                    'type' => 'string',
                    'default' => '',
                ],
            ],
            'render_callback' => [self::class, 'render'],
            'supports' => ['html' => false],
        ]);
    }

    public static function editor_assets(): void
    {
        wp_enqueue_script(
            'grwi-block',
            GRWI_PLUGIN_URL . 'assets/block.js',
            ['wp-blocks', 'wp-element', 'wp-components', 'wp-block-editor', 'wp-i18n'],
            GRWI_VERSION,
            true
        );

        wp_localize_script('grwi-block', 'grwiBlock', [
            'widgets' => self::picker_widgets(),
        ]);
    }

    /**
     * Widgets for the block dropdown (same list the admin screen uses).
     *
     * @return array<int, array{embedKey: string, label: string}>
     */
    public static function picker_widgets(): array
    {
        $client = new GRWI_API_Client();
        if (! $client->is_registered() && ! $client->is_linked()) {
            return [];
        }

        $response = $client->get_widgets();
        if (is_wp_error($response) || ! is_array($response)) {
            return [];
        }

        $widgets = is_array($response['widgets'] ?? null) ? $response['widgets'] : [];

        return GRWI_Admin::widget_picker_items($widgets);
    }

    /**
     * @param array<string, mixed> $attributes
     */
    public static function render(array $attributes): string
    {
        $embed_key = sanitize_text_field($attributes['embedKey'] ?? '');

        return GRWI_Shortcode::render(['id' => $embed_key]);
    }

    public static function content_has_block(string $content): bool
    {
        if ($content === '' || ! function_exists('has_block')) {
            return false;
        }

        return has_block('grwi-widget/embed', $content) || has_block('gr-widget/embed', $content);
    }
}
