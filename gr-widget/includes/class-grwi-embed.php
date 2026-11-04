<?php

defined('ABSPATH') || exit;

/**
 * Conditionally load grwidget.js on pages that render GR widgets.
 */
final class GRWI_Embed
{
    private static bool $needed = false;

    private static bool $hooks_registered = false;

    /**
     * True when post content, custom HTML, or a widget already includes a hosted grwidget.js tag.
     */
    private static bool $hosted_script_in_document = false;

    public static function register(): void
    {
        if (self::$hooks_registered) {
            return;
        }

        self::$hooks_registered = true;

        add_action('template_redirect', [self::class, 'detect_on_page'], 1);
        add_action('wp_enqueue_scripts', [self::class, 'maybe_enqueue'], 20);
        add_filter('script_loader_tag', [self::class, 'filter_embed_tag'], 10, 3);
    }

    /**
     * Mark the current page as needing the embed script (shortcode/block render).
     */
    public static function mark_needed(): void
    {
        if (is_admin()) {
            return;
        }

        self::$needed = true;
        self::maybe_enqueue();
    }

    public static function detect_on_page(): void
    {
        if (is_admin()) {
            return;
        }

        if (is_singular()) {
            global $post;
            if ($post instanceof WP_Post) {
                if (self::content_has_hosted_script($post->post_content)) {
                    self::$hosted_script_in_document = true;
                }
                if (self::content_has_widget($post->post_content)) {
                    self::$needed = true;
                }
            }
        }

        self::scan_widget_areas();
    }

    public static function maybe_enqueue(): void
    {
        if (is_admin() || ! self::$needed) {
            return;
        }

        if (self::is_script_already_present()) {
            return;
        }

        $script = (string) get_option('grwi_embed_script_url', GRWI_EMBED_SCRIPT);
        if ($script === '') {
            return;
        }

        wp_enqueue_script('grwi-embed', esc_url($script), [], GRWI_VERSION, true);
    }

    /**
     * Print the hosted embed once. Skip if a theme, Custom HTML, or pasted snippet
     * already put grwidget.js in the document (header/content/footer before this tag).
     *
     * @param string $tag    Script tag HTML.
     * @param string $handle Script handle.
     * @param string $src    Script URL.
     */
    public static function filter_embed_tag(string $tag, string $handle, string $src = ''): string
    {
        if ($handle !== 'grwi-embed') {
            return $tag;
        }

        $src = $src !== '' ? $src : (string) get_option('grwi_embed_script_url', GRWI_EMBED_SCRIPT);
        if ($src === '') {
            return '';
        }

        return sprintf(
            '<script id="grwi-embed-guard" data-wpmeteor-nooptimize="true">(function(){if(document.querySelector("script[src*=\\"grwidget.js\\"]")){return;}var s=document.createElement("script");s.src=%s;s.async=true;s.defer=true;s.setAttribute("data-wpmeteor-nooptimize","true");document.head.appendChild(s);})();</script>' . "\n",
            wp_json_encode(esc_url($src))
        );
    }

    /**
     * @deprecated 1.1.1 Use filter_embed_tag(); kept so older tests/hooks still resolve.
     *
     * @param string $tag    Script tag HTML.
     * @param string $handle Script handle.
     */
    public static function add_async_defer(string $tag, string $handle): string
    {
        return self::filter_embed_tag($tag, $handle);
    }

    /**
     * True when a raw <script src="…grwidget.js"> is already in post content or widgets.
     */
    public static function content_has_hosted_script(string $content): bool
    {
        if ($content === '' || stripos($content, 'grwidget.js') === false) {
            return false;
        }

        if (preg_match('/<script\b[^>]*\bsrc\s*=\s*([\'"]?)[^\'"\s>]*grwidget\.js/i', $content) === 1) {
            return true;
        }

        // Escaped HTML in some page-builder stores.
        if (preg_match('/&lt;script\b[^&]*\bsrc\s*=\s*([\'"]?)[^\'">]*grwidget\.js/i', $content) === 1) {
            return true;
        }

        return false;
    }

    private static function is_script_already_present(): bool
    {
        if (self::$hosted_script_in_document) {
            return true;
        }

        if (is_singular()) {
            global $post;
            if ($post instanceof WP_Post && self::content_has_hosted_script($post->post_content)) {
                self::$hosted_script_in_document = true;

                return true;
            }
        }

        if (wp_script_is('grwi-embed', 'enqueued') || wp_script_is('grwi-embed', 'done')) {
            return true;
        }

        global $wp_scripts;
        if (! ($wp_scripts instanceof WP_Scripts)) {
            return false;
        }

        foreach ($wp_scripts->queue as $handle) {
            if (! isset($wp_scripts->registered[$handle])) {
                continue;
            }

            $src = (string) ($wp_scripts->registered[$handle]->src ?? '');
            if ($src !== '' && strpos($src, 'grwidget.js') !== false) {
                return true;
            }
        }

        return false;
    }

    private static function content_has_widget(string $content): bool
    {
        if ($content === '') {
            return false;
        }

        if (GRWI_Shortcode::content_has_widget($content)) {
            return true;
        }

        if (function_exists('has_block') && GRWI_Blocks::content_has_block($content)) {
            return true;
        }

        return strpos($content, 'grwidget-embed') !== false;
    }

    private static function scan_widget_areas(): void
    {
        $sidebars = get_option('sidebars_widgets', []);
        if (! is_array($sidebars)) {
            return;
        }

        /** This filter is documented in wp-includes/widgets.php */
        // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WordPress core filter; cannot be prefixed.
        $sidebars = apply_filters('sidebars_widgets', $sidebars);

        foreach ($sidebars as $widgets) {
            if (! is_array($widgets)) {
                continue;
            }

            foreach ($widgets as $widget_id) {
                $content = self::widget_instance_content((string) $widget_id);
                if ($content === '') {
                    continue;
                }
                if (self::content_has_hosted_script($content)) {
                    self::$hosted_script_in_document = true;
                }
                if (self::content_has_widget($content)) {
                    self::$needed = true;
                }
            }
        }
    }

    private static function widget_instance_content(string $widget_id): string
    {
        if (preg_match('/^block-(\d+)$/', $widget_id, $matches) === 1) {
            $blocks = get_option('widget_block', []);
            $num = (int) $matches[1];
            if (! empty($blocks[$num]['content'])) {
                return (string) $blocks[$num]['content'];
            }
        }

        if (preg_match('/^text-(\d+)$/', $widget_id, $matches) === 1) {
            $texts = get_option('widget_text', []);
            $num = (int) $matches[1];
            if (! empty($texts[$num]['text'])) {
                return (string) $texts[$num]['text'];
            }
        }

        if (preg_match('/^custom_html-(\d+)$/', $widget_id, $matches) === 1) {
            $html_widgets = get_option('widget_custom_html', []);
            $num = (int) $matches[1];
            if (! empty($html_widgets[$num]['content'])) {
                return (string) $html_widgets[$num]['content'];
            }
        }

        return '';
    }
}
