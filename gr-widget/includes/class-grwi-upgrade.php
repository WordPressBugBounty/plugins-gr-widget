<?php

defined('ABSPATH') || exit;

/**
 * Contextual upgrade notices — not global popups.
 */
class GRWI_Upgrade
{
    public static function register(): void
    {
        // Upgrade messaging is limited to wp-admin (see Widgets card limit card).
    }

    /**
     * Legacy top-of-page banner — intentionally a no-op.
     * Widget-limit messaging lives once inside the Widgets card.
     *
     * @param array<string, mixed> $caps
     */
    public static function render_admin_banner(array $caps, bool $can_create): void
    {
        unset($caps, $can_create);
    }

    /**
     * Compact widget-limit card shown once in the Widgets section.
     *
     * @param array<string, mixed> $caps
     * @param array{
     *   max_widgets?: int|null,
     *   linked_max_widgets?: int,
     *   linked_free_layouts?: int,
     *   is_linked?: bool
     * } $context
     */
    public static function render_widget_limit_card(array $caps, array $context = []): void
    {
        $is_linked = ! empty($context['is_linked']);
        $max_widgets = array_key_exists('max_widgets', $context)
            ? $context['max_widgets']
            : ($caps['limits']['max_widgets'] ?? 1);
        $max_widgets = $max_widgets === null ? 1 : max(1, (int) $max_widgets);
        $linked_max_widgets = max(1, (int) ($context['linked_max_widgets'] ?? 3));
        $linked_free_layouts = max(0, (int) ($context['linked_free_layouts'] ?? 0));
        $upgrade = esc_url($caps['upgrade_url'] ?? 'https://grwidget.com/blog/wordpress-plugin-upgrade?source=wordpress');
        $trial = esc_url($caps['trial_url'] ?? 'https://grwidget.com/pricing?source=wordpress&plan=site&cycle=monthly');

        if ($is_linked) {
            $title = sprintf(
                /* translators: %d: included widget allowance on the current plan. */
                _n(
                    'You’ve used your %d included widget',
                    'You’ve used your %d included widgets',
                    $max_widgets,
                    'gr-widget'
                ),
                $max_widgets
            );
            $body = __('Upgrade on GRWidget.com for more widgets and every layout.', 'gr-widget');
            ?>
            <div class="grw-widget-limit-card" role="status">
                <div class="grw-widget-limit-card__copy">
                    <p class="grw-widget-limit-card__title"><?php echo esc_html($title); ?></p>
                    <p class="grw-widget-limit-card__body"><?php echo esc_html($body); ?></p>
                </div>
                <div class="grw-widget-limit-card__action">
                    <a class="button button-primary grw-widget-limit-card__cta" href="<?php echo esc_url($trial !== '' ? $trial : $upgrade); ?>" target="_blank" rel="noopener noreferrer">
                        <?php esc_html_e('Start free trial', 'gr-widget'); ?>
                    </a>
                </div>
            </div>
            <?php
            return;
        }

        $title = sprintf(
            /* translators: %d: included widget allowance while unlinked. */
            _n(
                'You’ve used your %d included widget',
                'You’ve used your %d included widgets',
                $max_widgets,
                'gr-widget'
            ),
            $max_widgets
        );

        if ($linked_free_layouts > 0) {
            $body = sprintf(
                /* translators: 1: linked free widget allowance, 2: additional layouts unlocked by linking. */
                __('Link a free GR Widget account to create up to %1$d widgets and unlock %2$d more layouts.', 'gr-widget'),
                $linked_max_widgets,
                $linked_free_layouts
            );
        } else {
            $body = sprintf(
                /* translators: %d: linked free widget allowance. */
                __('Link a free GR Widget account to create up to %d widgets.', 'gr-widget'),
                $linked_max_widgets
            );
        }
        ?>
        <div class="grw-widget-limit-card" role="status">
            <div class="grw-widget-limit-card__copy">
                <p class="grw-widget-limit-card__title"><?php echo esc_html($title); ?></p>
                <p class="grw-widget-limit-card__body"><?php echo esc_html($body); ?></p>
            </div>
            <div class="grw-widget-limit-card__action">
                <button type="button" class="button button-primary grw-widget-limit-card__cta" data-grwi-connect-account>
                    <?php esc_html_e('Link free account', 'gr-widget'); ?>
                </button>
            </div>
        </div>
        <?php
    }

    /**
     * @param array<string, mixed> $caps
     */
    public static function widget_limit_message(array $caps): string
    {
        $message = $caps['upgrade_messages']['widget_limit'] ?? __('Widget limit reached.', 'gr-widget');
        $upgrade = esc_url($caps['upgrade_url'] ?? 'https://grwidget.com/blog/wordpress-plugin-upgrade?source=wordpress');
        $link = esc_url($caps['link_url'] ?? 'https://grwidget.com/dashboard/account#wordpress');
        $is_unlinked = (($caps['plan'] ?? '') === 'wordpress') && empty($caps['account']);

        if ($is_unlinked) {
            return sprintf(
                '%s <a href="%s" target="_blank" rel="noopener noreferrer">%s</a>',
                esc_html($message),
                $link,
                esc_html__('Link a free account', 'gr-widget')
            );
        }

        return sprintf(
            '%s <a href="%s" target="_blank" rel="noopener noreferrer">%s</a> · <a href="%s" target="_blank" rel="noopener noreferrer">%s</a>',
            esc_html($message),
            $upgrade,
            esc_html__('View plans & start free trial', 'gr-widget'),
            $link,
            esc_html__('Link account', 'gr-widget')
        );
    }

    /**
     * @param array<string, mixed> $layout
     */
    public static function locked_layout_hint(array $layout): string
    {
        if (empty($layout['locked'])) {
            return '';
        }

        $plan = sanitize_text_field($layout['upgrade_plan'] ?? '');
        $message = $plan !== ''
            ? sprintf(
                /* translators: %s: GR Widget plan name (e.g. Pro). */
                __('Requires %s plan or higher — start a 7-day free trial.', 'gr-widget'),
                $plan
            )
            : __('Requires a paid plan — start a 7-day free trial.', 'gr-widget');

        return $message;
    }
}
