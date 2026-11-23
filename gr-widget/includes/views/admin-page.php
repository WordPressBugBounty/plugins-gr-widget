<?php

defined('ABSPATH') || exit;

/** Admin page markup (included from GRWI_Admin). */

$grwi_plan_badge = $is_linked
    ? sanitize_text_field($linked_account['plan_name'] ?? __('Linked', 'gr-widget'))
    : __('Unlinked', 'gr-widget');
$grwi_widget_count = count($widgets);
$grwi_embed_keys = [];
foreach ($widgets as $grwi_key_row) {
    if (! is_array($grwi_key_row)) {
        continue;
    }
    $grwi_ek = sanitize_text_field((string) ($grwi_key_row['embed_key'] ?? ''));
    if ($grwi_ek !== '') {
        $grwi_embed_keys[] = $grwi_ek;
    }
}
$grwi_max_widgets = array_key_exists('max_widgets', $caps['limits'] ?? [])
    ? $caps['limits']['max_widgets']
    : null;
$grwi_widgets_unlimited = $is_linked
    ? (! empty($linked_account['usage']['widgets']['unlimited']) || $grwi_max_widgets === null)
    : ($grwi_max_widgets === null);
if (! $is_linked && $grwi_max_widgets === null) {
    $grwi_max_widgets = 1;
}
$grwi_max_reviews = array_key_exists('max_reviews_display', $caps['limits'] ?? [])
    ? $caps['limits']['max_reviews_display']
    : null;
$grwi_linked_email = sanitize_email($linked_account['email'] ?? '');
$grwi_linked_name = sanitize_text_field($linked_account['name'] ?? '');
$grwi_linked_plan_name = sanitize_text_field($linked_account['plan_name'] ?? '');
$grwi_footer_plan_name = $is_linked
    ? ($grwi_linked_plan_name !== ''
        ? $grwi_linked_plan_name
        : sanitize_text_field($caps['account']['plan_name'] ?? $caps['plan_name'] ?? __('Linked', 'gr-widget')))
    : sanitize_text_field($caps['plan_name'] ?? __('Unlinked', 'gr-widget'));
if ($grwi_max_reviews === null && ! $is_linked) {
    $grwi_max_reviews = 5;
}
$grwi_trial_url_raw = (string) ($caps['trial_url'] ?? 'https://grwidget.com/pricing?source=wordpress&plan=site&cycle=monthly');
if (! $is_linked && (int) ($site_id ?? 0) > 0) {
    $grwi_trial_url_raw = add_query_arg('site_id', (int) $site_id, $grwi_trial_url_raw);
}
$grwi_trial_url = esc_url($grwi_trial_url_raw);
$grwi_compare_plans_url = esc_url('https://grwidget.com/pricing?source=wordpress');
$grwi_trial_eligible = array_key_exists('trial_eligible', $caps) ? $caps['trial_eligible'] : null;
$grwi_site_trial_copy = is_array($caps['trial_copy']['site'] ?? null) ? $caps['trial_copy']['site'] : [];
$grwi_reviews_shown_label = $grwi_max_reviews === null
    ? __('Unlimited', 'gr-widget')
    : sprintf(
        /* translators: %d: maximum reviews shown per widget on the current plan. */
        __('Up to %d per widget', 'gr-widget'),
        (int) $grwi_max_reviews
    );
$grwi_layout_preview_theme = sanitize_key($caps['layout_preview_theme'] ?? 'light');
$grwi_linked_widget_usage = is_array($linked_account['usage']['widgets'] ?? null) ? $linked_account['usage']['widgets'] : [];
$grwi_linked_domain_usage = is_array($linked_account['usage']['domains'] ?? null) ? $linked_account['usage']['domains'] : [];
$grwi_google_usage = [];
if ($is_linked && is_array($linked_account['usage']['google_businesses'] ?? null)) {
    $grwi_google_usage = $linked_account['usage']['google_businesses'];
} elseif (is_array($caps['usage']['google_businesses'] ?? null)) {
    $grwi_google_usage = $caps['usage']['google_businesses'];
}
$grwi_google_label = '';
if (is_string($grwi_google_usage['ratio_label'] ?? null) && $grwi_google_usage['ratio_label'] !== '') {
    $grwi_google_label = $grwi_google_usage['ratio_label'];
} elseif (isset($caps['limits']['max_google_businesses']) && is_numeric($caps['limits']['max_google_businesses'])) {
    $grwi_google_label = (string) (int) $caps['limits']['max_google_businesses'];
}
$grwi_billing_url = esc_url($linked_account['billing_url'] ?? $link_url);

// Display-only flash params from trusted admin redirects (no state change).
// phpcs:ignore WordPress.Security.NonceVerification.Recommended
$grwi_error = isset($_GET['grwi_error']) ? sanitize_text_field(wp_unslash($_GET['grwi_error'])) : '';
// phpcs:ignore WordPress.Security.NonceVerification.Recommended
$grwi_upgrade_raw = isset($_GET['grwi_upgrade']) ? esc_url_raw(wp_unslash($_GET['grwi_upgrade'])) : '';
$grwi_upgrade_parts = wp_parse_url($grwi_upgrade_raw);
$grwi_upgrade_host = is_array($grwi_upgrade_parts) ? strtolower((string) ($grwi_upgrade_parts['host'] ?? '')) : '';
$grwi_upgrade = (
    is_array($grwi_upgrade_parts)
    && strtolower((string) ($grwi_upgrade_parts['scheme'] ?? '')) === 'https'
    && in_array($grwi_upgrade_host, ['grwidget.com', 'www.grwidget.com', 'staging.grwidget.com'], true)
) ? $grwi_upgrade_raw : '';
// phpcs:ignore WordPress.Security.NonceVerification.Recommended
$grwi_created = ! empty($_GET['grwi_created']);
// phpcs:ignore WordPress.Security.NonceVerification.Recommended
$grwi_linked = ! empty($_GET['grwi_linked']);
// phpcs:ignore WordPress.Security.NonceVerification.Recommended
$grwi_saved = ! empty($_GET['grwi_saved']);
// phpcs:ignore WordPress.Security.NonceVerification.Recommended
$grwi_refreshed = ! empty($_GET['grwi_refreshed']);
// phpcs:ignore WordPress.Security.NonceVerification.Recommended
$grwi_unlinked = ! empty($_GET['grwi_unlinked']);
// phpcs:ignore WordPress.Security.NonceVerification.Recommended
$grwi_widget_created = isset($_GET['grwi_widget']) ? sanitize_text_field(wp_unslash($_GET['grwi_widget'])) : '';
?>
<div class="wrap grw-admin<?php echo ! empty($caps['preview_first']) ? ' grw-admin--preview-first' : ''; ?>" data-can-create="<?php echo ! empty($can_create) ? '1' : '0'; ?>" data-widget-count="<?php echo (int) $grwi_widget_count; ?>" data-embed-keys="<?php echo esc_attr(implode(',', $grwi_embed_keys)); ?>" data-linked="<?php echo $is_linked ? '1' : '0'; ?>" data-preview-first="<?php echo ! empty($caps['preview_first']) ? '1' : '0'; ?>">
    <div id="grwi-admin-notices" class="grw-admin-notices" aria-live="polite"></div>
    <?php if ($grwi_error !== '') : ?>
        <div class="notice notice-error is-dismissible"><p><?php echo esc_html($grwi_error); ?><?php if ($grwi_upgrade !== '') : ?> <a href="<?php echo esc_url($grwi_upgrade); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e('View plans', 'gr-widget'); ?></a><?php endif; ?></p></div>
    <?php elseif (! empty($widgets_error)) : ?>
        <?php /* Styled in the widgets panel below — avoid a second WP core notice. */ ?>
    <?php elseif (! empty($connection_notice)) : ?>
        <div class="notice notice-warning is-dismissible"><p><?php echo esc_html($connection_notice); ?></p></div>
    <?php elseif ($grwi_unlinked) : ?>
        <div class="notice notice-success is-dismissible"><p><?php esc_html_e('Site unlinked from your GR Widget account.', 'gr-widget'); ?></p></div>
    <?php elseif ($grwi_linked) : ?>
        <div class="notice notice-success is-dismissible"><p><?php esc_html_e('Site linked to your GR Widget account.', 'gr-widget'); ?></p></div>
    <?php elseif ($grwi_created) : ?>
        <div class="notice notice-success is-dismissible">
            <p><?php esc_html_e('Widget created successfully.', 'gr-widget'); ?></p>
        </div>
    <?php elseif ($grwi_saved) : ?>
        <div class="notice notice-success is-dismissible"><p><?php esc_html_e('API token updated.', 'gr-widget'); ?></p></div>
    <?php elseif ($grwi_refreshed) : ?>
        <div class="notice notice-success is-dismissible"><p><?php esc_html_e('Plan limits refreshed.', 'gr-widget'); ?></p></div>
    <?php endif; ?>

    <header class="grw-hero">
        <div class="grw-hero__brand">
            <img
                class="grw-hero__logo"
                src="<?php echo esc_url(GRWI_PLUGIN_URL . 'assets/logo.webp'); ?>"
                alt="<?php esc_attr_e('GR Widget — Google Reviews Widget', 'gr-widget'); ?>"
                title="<?php esc_attr_e('GR Widget — Google Reviews Widget', 'gr-widget'); ?>"
                width="360"
                height="109"
                decoding="async"
            />
            <p class="grw-hero__tagline"><?php esc_html_e('Beautiful Google review widgets for WordPress — kept in sync and professionally rendered by GRWidget.com.', 'gr-widget'); ?></p>
        </div>
        <span class="grw-admin-badge grw-admin-badge--plan<?php echo $is_linked ? ' grw-admin-badge--linked' : ''; ?>">
            <?php echo esc_html($grwi_plan_badge); ?>
        </span>
    </header>

    <?php
    $grwi_review_ask = get_option('grwi_wp_review_prompt', []);
    $grwi_review_ask_status = is_array($grwi_review_ask) ? (string) ($grwi_review_ask['status'] ?? '') : '';
    $grwi_review_ask_until = is_array($grwi_review_ask) ? (int) ($grwi_review_ask['until'] ?? 0) : 0;
    $grwi_show_review_ask = $grwi_widget_count > 0
        && $grwi_review_ask_status !== 'dismissed'
        && $grwi_review_ask_status !== 'reviewed'
        && ! ($grwi_review_ask_status === 'later' && $grwi_review_ask_until > time());
    ?>
    <?php if ($grwi_show_review_ask) : ?>
        <section class="grwi-review-ask" id="grwi-review-ask" aria-labelledby="grwi-review-ask-title">
            <span class="grwi-review-ask__logo" aria-hidden="true"><span class="dashicons dashicons-wordpress"></span></span>
            <div class="grwi-review-ask__copy">
                <h2 id="grwi-review-ask-title" class="grwi-review-ask__title">
                    <?php esc_html_e('How\'s GR Widget working for you?', 'gr-widget'); ?>
                </h2>
                <p class="grwi-review-ask__text"><?php esc_html_e('If you have used GR Widget, we welcome your honest review on WordPress.org, whether positive or critical. Your experience helps other users and helps us improve.', 'gr-widget'); ?></p>
            </div>
            <div class="grwi-review-ask__actions">
                <a class="grwi-review-ask__leave" data-grwi-review-ask="review" href="https://wordpress.org/support/plugin/gr-widget/reviews/#new-post" target="_blank" rel="noopener noreferrer"><?php esc_html_e('Leave a review', 'gr-widget'); ?></a>
                <button type="button" class="grwi-review-ask__later" data-grwi-review-ask="later"><?php esc_html_e('Maybe later', 'gr-widget'); ?></button>
                <button type="button" class="grwi-review-ask__dismiss" data-grwi-review-ask="dismiss"><?php esc_html_e('Dismiss', 'gr-widget'); ?></button>
                <button type="button" class="grwi-review-ask__close" data-grwi-review-ask="dismiss" aria-label="<?php esc_attr_e('Dismiss', 'gr-widget'); ?>">&times;</button>
            </div>
        </section>
    <?php endif; ?>

    <div class="grw-layout">
        <main class="grw-main">
            <?php if (! empty($widgets) || ! empty($widgets_error)) : ?>
            <section class="grw-panel grw-panel--widgets grw-widget-library" aria-labelledby="grwi-widgets-heading">
                <div class="grw-widget-library__header">
                    <div class="grw-widget-library__heading">
                        <h2 id="grwi-widgets-heading" class="grw-widget-library__title"><?php esc_html_e('Widgets', 'gr-widget'); ?></h2>
                        <p class="grw-widget-library__subtitle" id="grwi-widgets-count-label">
                            <?php
                            if (! empty($widgets_error)) {
                                echo ! empty($widgets_reconnect)
                                    ? esc_html__('Could not load widgets — reconnect required', 'gr-widget')
                                    : esc_html__('Could not load widgets', 'gr-widget');
                            } else {
                                printf(
                                    /* translators: %d: number of widgets on this site. */
                                    esc_html(_n('%d widget on this site', '%d widgets on this site', (int) $grwi_widget_count, 'gr-widget')),
                                    (int) $grwi_widget_count
                                );
                            }
                            ?>
                        </p>
                    </div>
                    <?php if ($grwi_widget_count > 0) : ?>
                        <div class="grw-widget-library__header-actions">
                            <button
                                type="button"
                                class="grw-widget-library__create"
                                id="grwi-create-widget-btn"
                                aria-expanded="<?php echo ($grwi_widget_created !== '') ? 'true' : 'false'; ?>"
                                aria-controls="grwi-create-panel"
                            >
                                <span aria-hidden="true">+</span>
                                <?php echo ! empty($can_create)
                                    ? esc_html__('Create another widget', 'gr-widget')
                                    : esc_html__('Browse layouts', 'gr-widget'); ?>
                            </button>
                        </div>
                    <?php endif; ?>
                </div>

                <?php if (! empty($grwi_review_gap['lead'])) : ?>
                    <?php
                    $grwi_gap_total = (int) ($grwi_review_gap['google_total'] ?? 0);
                    $grwi_gap_limit = (int) ($grwi_review_gap['plan_limit'] ?? 0);
                    $grwi_gap_current = trim((string) ($grwi_review_gap['current_plan_name'] ?? ''));
                    if ($grwi_gap_current === '' && $is_linked && $grwi_linked_plan_name !== '') {
                        $grwi_gap_current = $grwi_linked_plan_name;
                    }
                    $grwi_gap_upgrade = trim((string) ($grwi_review_gap['upgrade_line'] ?? ''));
                    $grwi_gap_plan_key = sanitize_key((string) ($grwi_review_gap['plan_key'] ?? ''));
                    $grwi_gap_more = max(0, $grwi_gap_total - $grwi_gap_limit);
                    $grwi_gap_plan_label = $grwi_gap_current !== '' ? $grwi_gap_current : __('current', 'gr-widget');
                    $grwi_gap_title = $grwi_gap_total > 0
                        ? sprintf(
                            /* translators: %s: number of Google reviews on the business. */
                            __('Your business has %s Google reviews!', 'gr-widget'),
                            number_format_i18n($grwi_gap_total)
                        )
                        : trim((string) $grwi_review_gap['lead']);
                    $grwi_gap_body = ($grwi_gap_total > 0 && $grwi_gap_limit > 0 && $grwi_gap_more > 0)
                        ? sprintf(
                            /* translators: 1: current plan name, 2: reviews this plan includes, 3: reviews still not shown. */
                            __('Your %1$s plan includes up to %2$s reviews, but you\'ve got another %3$s that could be helping build trust with your website visitors.', 'gr-widget'),
                            $grwi_gap_plan_label,
                            number_format_i18n($grwi_gap_limit),
                            number_format_i18n($grwi_gap_more)
                        )
                        : '';
                    $grwi_site_review_cap = 30;
                    $grwi_gap_can_trial = $grwi_trial_eligible !== false;
                    $grwi_gap_business_trial = trim((string) ($caps['business_trial_url'] ?? ''));
                    if ($grwi_gap_business_trial === '') {
                        $grwi_gap_business_trial = 'https://grwidget.com/pricing?source=wordpress&plan=business&cycle=monthly';
                    }
                    $grwi_gap_site_trial = $grwi_trial_url;
                    $grwi_gap_offer_site = $grwi_gap_limit < $grwi_site_review_cap;
                    $grwi_gap_offer_business = $grwi_gap_plan_key === 'business' || $grwi_gap_total > $grwi_site_review_cap;

                    $grwi_gap_offer_html = '';
                    if ($grwi_gap_offer_site && $grwi_gap_offer_business && $grwi_gap_total > $grwi_site_review_cap) {
                        $grwi_gap_offer_html = $grwi_gap_can_trial
                            ? sprintf(
                                /* translators: 1: Site plan review cap, 2: total Google reviews. */
                                __('Start a free trial of <strong>Site to display up to %1$s</strong> reviews, or <strong>Business to display all %2$s</strong>.', 'gr-widget'),
                                number_format_i18n($grwi_site_review_cap),
                                number_format_i18n($grwi_gap_total)
                            )
                            : sprintf(
                                /* translators: 1: Site plan review cap, 2: total Google reviews. */
                                __('Upgrade to <strong>Site to display up to %1$s</strong> reviews, or <strong>Business to display all %2$s</strong>.', 'gr-widget'),
                                number_format_i18n($grwi_site_review_cap),
                                number_format_i18n($grwi_gap_total)
                            );
                    } elseif ($grwi_gap_offer_site && $grwi_gap_total > 0) {
                        $grwi_gap_offer_html = $grwi_gap_can_trial
                            ? sprintf(
                                /* translators: %s: review count. */
                                __('Start a free trial of <strong>Site to display all %s</strong> reviews.', 'gr-widget'),
                                number_format_i18n($grwi_gap_total)
                            )
                            : sprintf(
                                /* translators: %s: review count. */
                                __('Upgrade to <strong>Site to display all %s</strong> reviews.', 'gr-widget'),
                                number_format_i18n($grwi_gap_total)
                            );
                    } elseif ($grwi_gap_offer_business && $grwi_gap_total > 0) {
                        $grwi_gap_offer_html = $grwi_gap_can_trial
                            ? sprintf(
                                /* translators: %s: review count. */
                                __('Start a free trial of <strong>Business to display all %s</strong>.', 'gr-widget'),
                                number_format_i18n($grwi_gap_total)
                            )
                            : sprintf(
                                /* translators: %s: review count. */
                                __('Upgrade to <strong>Business to display all %s</strong>.', 'gr-widget'),
                                number_format_i18n($grwi_gap_total)
                            );
                    } elseif ($grwi_gap_upgrade !== '') {
                        $grwi_gap_offer_html = esc_html($grwi_gap_upgrade);
                    }

                    $grwi_gap_site_label = $grwi_gap_can_trial
                        ? __('Start 7-day Site trial', 'gr-widget')
                        : (string) ($grwi_site_trial_copy['ineligible_cta'] ?? __('Upgrade to Site', 'gr-widget'));
                    $grwi_gap_business_copy = is_array($caps['trial_copy']['business'] ?? null) ? $caps['trial_copy']['business'] : [];
                    $grwi_gap_business_label = $grwi_gap_can_trial
                        ? __('Start 7-day Business trial', 'gr-widget')
                        : (string) ($grwi_gap_business_copy['ineligible_cta'] ?? __('Upgrade to Business', 'gr-widget'));
                    ?>
                    <div class="grwi-dash-gap" id="grwi-dashboard-review-sync">
                        <div class="grwi-dash-gap__card">
                            <span class="grwi-dash-gap__mark" aria-hidden="true">
                                <svg viewBox="0 0 48 48" width="38" height="38">
                                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
                                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
                                    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.5 7.1l6.2 5.2C37.4 38.4 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/>
                                </svg>
                            </span>
                            <div class="grwi-dash-gap__copy">
                                <h3 class="grwi-dash-gap__title"><?php echo esc_html($grwi_gap_title); ?></h3>
                                <?php if ($grwi_gap_body !== '') : ?>
                                    <p class="grwi-dash-gap__body"><?php echo esc_html($grwi_gap_body); ?></p>
                                <?php endif; ?>
                                <?php if ($grwi_gap_offer_html !== '') : ?>
                                    <p class="grwi-dash-gap__offer"><?php echo wp_kses($grwi_gap_offer_html, ['strong' => []]); ?></p>
                                <?php endif; ?>
                            </div>
                            <div class="grwi-dash-gap__actions">
                                <?php if ($grwi_gap_offer_site) : ?>
                                    <a class="grwi-dash-gap__btn grwi-dash-gap__btn--primary" href="<?php echo esc_url($grwi_gap_site_trial); ?>" target="_blank" rel="noopener noreferrer">
                                        <?php echo esc_html($grwi_gap_site_label); ?>
                                    </a>
                                <?php endif; ?>
                                <?php if ($grwi_gap_offer_business) : ?>
                                    <a class="grwi-dash-gap__btn grwi-dash-gap__btn--primary" href="<?php echo esc_url($grwi_gap_business_trial); ?>" target="_blank" rel="noopener noreferrer">
                                        <?php echo esc_html($grwi_gap_business_label); ?>
                                    </a>
                                <?php endif; ?>
                                <a class="grwi-dash-gap__compare" href="<?php echo esc_url($grwi_compare_plans_url); ?>" target="_blank" rel="noopener noreferrer">
                                    <?php esc_html_e('Compare all plans', 'gr-widget'); ?>
                                </a>
                            </div>
                        </div>
                    </div>
                <?php endif; ?>

                <?php
                // Entitlement counts for limit-card copy (layout catalog, not widget allowance).
                $grwi_limit_card_layout_counts = ['unlinked' => 0, 'linked_free' => 0, 'site' => 0];
                foreach ($layout_meta as $grwi_limit_meta_row) {
                    if (! is_array($grwi_limit_meta_row)) {
                        continue;
                    }
                    $grwi_limit_entitlement = sanitize_key($grwi_limit_meta_row['entitlement'] ?? '');
                    if ($grwi_limit_entitlement === '' || $grwi_limit_entitlement === 'link_account') {
                        $grwi_legacy_lock_tier = sanitize_key($grwi_limit_meta_row['lock_tier'] ?? '');
                        if ($grwi_legacy_lock_tier === 'link_account' || $grwi_limit_entitlement === 'link_account') {
                            $grwi_limit_entitlement = 'linked_free';
                        } elseif (! empty($grwi_limit_meta_row['locked']) || $grwi_legacy_lock_tier === 'site') {
                            $grwi_limit_entitlement = 'site';
                        } else {
                            $grwi_limit_entitlement = 'unlinked';
                        }
                    }
                    if (isset($grwi_limit_card_layout_counts[$grwi_limit_entitlement])) {
                        $grwi_limit_card_layout_counts[$grwi_limit_entitlement]++;
                    }
                }
                ?>
                <?php if (empty($can_create)) : ?>
                    <?php
                    GRWI_Upgrade::render_widget_limit_card($caps, [
                        'is_linked' => $is_linked,
                        'max_widgets' => $grwi_max_widgets,
                        'linked_max_widgets' => 3,
                        'linked_free_layouts' => (int) $grwi_limit_card_layout_counts['linked_free'],
                    ]);
                    ?>
                <?php endif; ?>

                <?php if (! empty($widgets_error)) : ?>
                    <div class="grw-empty grw-empty--error" role="alert">
                        <h3 class="grw-empty__title">
                            <?php echo ! empty($widgets_reconnect)
                                ? esc_html__('Reconnect your GR Widget account', 'gr-widget')
                                : esc_html__('Could not load widgets', 'gr-widget'); ?>
                        </h3>
                        <p class="grw-empty__text"><?php echo esc_html($widgets_error); ?></p>
                        <p class="grw-empty__actions">
                            <?php if (! empty($widgets_reconnect)) : ?>
                                <button type="button" class="button button-primary" data-grwi-connect-account>
                                    <?php esc_html_e('Reconnect account', 'gr-widget'); ?>
                                </button>
                            <?php endif; ?>
                            <a class="button" href="<?php echo esc_url(GRWI_Admin::admin_page_url()); ?>"><?php esc_html_e('Try again', 'gr-widget'); ?></a>
                        </p>
                    </div>
                <?php else : ?>
                    <?php if ($grwi_widget_count >= 5) : ?>
                        <div class="grw-widget-library__search-wrap">
                            <label class="screen-reader-text" for="grwi-widget-search"><?php esc_html_e('Search widgets', 'gr-widget'); ?></label>
                            <span class="grw-widget-library__search-icon" aria-hidden="true">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667ZM14 14l-2.9-2.9" stroke="#98A2B3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            </span>
                            <input
                                type="search"
                                id="grwi-widget-search"
                                class="grw-widget-library__search"
                                placeholder="<?php echo esc_attr__('Search widgets…', 'gr-widget'); ?>"
                                autocomplete="off"
                            />
                        </div>
                    <?php endif; ?>

                    <div class="grw-widget-library__list" id="grwi-widget-list" role="list">
                        <?php foreach ($widgets as $grwi_widget) : ?>
                            <?php
                            $grwi_embed_key = sanitize_text_field($grwi_widget['embed_key'] ?? '');
                            $grwi_shortcode = '[grwi_widget id="' . $grwi_embed_key . '"]';
                            $grwi_layout_key = sanitize_key($grwi_widget['layout'] ?? '');
                            $grwi_layout_label = $layout_labels[$grwi_layout_key] ?? $grwi_layout_key;
                            $grwi_configure_url = GRWI_Admin::customize_url($grwi_embed_key, 'style');
                            $grwi_business_name = sanitize_text_field($grwi_widget['business_name'] ?? '');
                            $grwi_saved_name = sanitize_text_field($grwi_widget['name'] ?? '');
                            $grwi_is_live = ! empty($grwi_widget['is_active']);
                            $grwi_status_label = $grwi_is_live ? __('Live', 'gr-widget') : __('Draft', 'gr-widget');
                            // Never use business-only as the title — fall back to Business — Layout.
                            $grwi_has_custom_name = $grwi_saved_name !== ''
                                && $grwi_business_name !== ''
                                && strcasecmp($grwi_saved_name, $grwi_business_name) !== 0;
                            if ($grwi_has_custom_name) {
                                $grwi_display_name = $grwi_saved_name;
                            } elseif ($grwi_business_name !== '' && $grwi_layout_label !== '') {
                                $grwi_display_name = $grwi_business_name . ' — ' . $grwi_layout_label;
                            } elseif ($grwi_saved_name !== '') {
                                $grwi_display_name = $grwi_saved_name;
                            } else {
                                $grwi_display_name = $grwi_layout_label !== '' ? $grwi_layout_label : $grwi_embed_key;
                            }
                            $grwi_search_haystack = strtolower(implode(' ', array_filter([
                                $grwi_display_name,
                                $grwi_business_name,
                                $grwi_layout_label,
                                $grwi_status_label,
                                $grwi_saved_name,
                            ])));
                            /* translators: %s: widget name */
                            $grwi_more_label = sprintf(__('More actions for %s', 'gr-widget'), $grwi_display_name);
                            ?>
                            <article
                                class="grw-widget-row"
                                role="listitem"
                                data-embed-key="<?php echo esc_attr($grwi_embed_key); ?>"
                                data-widget-name="<?php echo esc_attr($grwi_display_name); ?>"
                                data-layout="<?php echo esc_attr($grwi_layout_key); ?>"
                                data-layout-label="<?php echo esc_attr($grwi_layout_label); ?>"
                                data-status="<?php echo esc_attr($grwi_is_live ? 'live' : 'draft'); ?>"
                                data-search="<?php echo esc_attr($grwi_search_haystack); ?>"
                            >
                                <div class="grw-widget-row__thumb" aria-hidden="true">
                                    <span
                                        class="grw-widget-row__mock grw-layout-card__mock"
                                        data-layout="<?php echo esc_attr($grwi_layout_key); ?>"
                                        data-preview-theme="<?php echo esc_attr($grwi_layout_preview_theme); ?>"
                                    >
                                        <span class="grw-layout-card__stage" data-grw-layout-stage>
                                            <span class="grw-layout-card__target" data-grw-layout-target data-grwidget-locale="<?php echo esc_attr(GRWI_Embed::frontend_locale()); ?>"></span>
                                        </span>
                                    </span>
                                </div>

                                <div class="grw-widget-row__identity">
                                    <p class="grw-widget-row__name"><?php echo esc_html($grwi_display_name); ?></p>
                                    <?php if ($grwi_business_name !== '') : ?>
                                        <p class="grw-widget-row__business"><?php echo esc_html($grwi_business_name); ?></p>
                                    <?php endif; ?>
                                </div>

                                <p class="grw-widget-row__layout"><?php echo esc_html($grwi_layout_label); ?></p>

                                <span class="grw-widget-row__status grw-widget-row__status--<?php echo $grwi_is_live ? 'live' : 'draft'; ?>">
                                    <?php echo esc_html($grwi_status_label); ?>
                                </span>

                                <div class="grw-widget-row__actions">
                                    <button
                                        type="button"
                                        class="grw-widget-row__btn grw-widget-row__btn--check"
                                        data-grwi-install-check-pick
                                        data-embed-key="<?php echo esc_attr($grwi_embed_key); ?>"
                                    >
                                        <?php esc_html_e('Check', 'gr-widget'); ?>
                                    </button>
                                    <button
                                        type="button"
                                        class="grw-widget-row__btn grw-widget-row__btn--preview grw-widget-preview-toggle"
                                        data-embed-key="<?php echo esc_attr($grwi_embed_key); ?>"
                                        data-widget-name="<?php echo esc_attr($grwi_display_name); ?>"
                                        data-layout="<?php echo esc_attr($grwi_layout_key); ?>"
                                        data-layout-label="<?php echo esc_attr($grwi_layout_label); ?>"
                                        aria-haspopup="dialog"
                                    >
                                        <span class="dashicons dashicons-visibility" aria-hidden="true"></span>
                                        <?php esc_html_e('Preview', 'gr-widget'); ?>
                                    </button>
                                    <button
                                        type="button"
                                        class="grw-widget-row__btn grw-widget-row__btn--icon grw-widget-row__copy-shortcode"
                                        data-copy="<?php echo esc_attr($grwi_shortcode); ?>"
                                        title="<?php esc_attr_e('Copy shortcode', 'gr-widget'); ?>"
                                        aria-label="<?php esc_attr_e('Copy shortcode', 'gr-widget'); ?>"
                                    >
                                        <span class="dashicons dashicons-admin-page" aria-hidden="true"></span>
                                    </button>
                                    <?php if ($grwi_configure_url !== '') : ?>
                                        <a class="grw-widget-row__btn grw-widget-row__btn--edit" href="<?php echo esc_url($grwi_configure_url); ?>">
                                            <?php esc_html_e('Edit widget', 'gr-widget'); ?>
                                        </a>
                                    <?php endif; ?>
                                    <div class="grw-widget-row__menu">
                                        <button
                                            type="button"
                                            class="grw-widget-row__btn grw-widget-row__btn--icon grw-widget-row__menu-toggle"
                                            aria-haspopup="menu"
                                            aria-expanded="false"
                                            aria-label="<?php echo esc_attr($grwi_more_label); ?>"
                                        >
                                            <span class="dashicons dashicons-ellipsis" aria-hidden="true"></span>
                                        </button>
                                        <div class="grw-widget-row__menu-panel" role="menu" hidden>
                                            <button type="button" class="grw-widget-row__menu-item" role="menuitem" data-grw-duplicate-widget data-embed-key="<?php echo esc_attr($grwi_embed_key); ?>">
                                                <?php esc_html_e('Duplicate widget', 'gr-widget'); ?>
                                            </button>
                                            <button type="button" class="grw-widget-row__menu-item" role="menuitem" data-copy="<?php echo esc_attr($grwi_shortcode); ?>">
                                                <?php esc_html_e('Copy shortcode', 'gr-widget'); ?>
                                            </button>
                                            <button
                                                type="button"
                                                class="grw-widget-row__menu-item grw-widget-row__menu-item--danger"
                                                role="menuitem"
                                                data-grw-delete-widget
                                                data-embed-key="<?php echo esc_attr($grwi_embed_key); ?>"
                                                data-widget-name="<?php echo esc_attr($grwi_display_name); ?>"
                                            >
                                                <?php esc_html_e('Delete widget', 'gr-widget'); ?>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        <?php endforeach; ?>
                    </div>

                    <p class="grw-widget-library__empty-filter" id="grwi-widget-search-empty" hidden>
                        <?php esc_html_e('No widgets match your search.', 'gr-widget'); ?>
                    </p>

                    <div class="grw-widget-library__install">
                        <span class="grw-widget-library__install-icon" aria-hidden="true">i</span>
                        <p class="grw-widget-library__install-text">
                            <?php esc_html_e('Add widgets with the GR Widget block or copy a shortcode from the widget menu.', 'gr-widget'); ?>
                        </p>
                        <a
                            class="grw-widget-library__install-link"
                            href="https://grwidget.com/blog/wordpress?source=wordpress-plugin"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <?php esc_html_e('Installation help', 'gr-widget'); ?>
                            <span class="dashicons dashicons-external" aria-hidden="true"></span>
                        </a>
                    </div>
                    <?php include GRWI_PLUGIN_DIR . 'includes/views/install-check.php'; ?>
                <?php endif; ?>
            </section>
            <?php endif; ?>

            <?php $grwi_create_collapsed = $grwi_widget_count > 0 && $grwi_widget_created === ''; ?>
            <section class="grw-panel grw-panel--create<?php echo $grwi_widget_created !== '' ? ' grw-panel--create-has-result' : ''; ?>" id="grwi-create-panel" aria-labelledby="grwi-create-heading"<?php echo $grwi_create_collapsed ? ' hidden' : ''; ?>>
                <?php if ($grwi_widget_created !== '') : ?>
                    <?php
                    $grwi_created_shortcode = '[grwi_widget id="' . esc_attr($grwi_widget_created) . '"]';
                    $grwi_created_customize_url = GRWI_Admin::customize_url($grwi_widget_created, 'style');
                    ?>
                    <div id="grwi-create-result" class="grw-create-result" role="status">
                        <div class="grw-create-result__head">
                            <h3 class="grw-create-result__title"><?php esc_html_e('Widget created', 'gr-widget'); ?></h3>
                            <p class="grw-create-result__hint"><?php esc_html_e('Copy the shortcode below or customize colors and display options.', 'gr-widget'); ?></p>
                        </div>
                        <div class="grw-create-result__preview" id="grwi-create-result-preview">
                            <div class="wb-preview-root grw-create-result__preview-root">
                                <div id="grwi-create-result-preview-mount" class="grw-live-preview__target" data-wb-builder-preview></div>
                            </div>
                        </div>
                        <div class="grw-create-result__codes">
                            <label class="grw-field__label" for="grwi-created-shortcode"><?php esc_html_e('Shortcode', 'gr-widget'); ?></label>
                            <div class="grw-shortcode-field">
                                <input type="text" id="grwi-created-shortcode" class="grw-shortcode-input" readonly value="<?php echo esc_attr($grwi_created_shortcode); ?>" />
                                <button type="button" class="button button-small grw-copy-btn grw-copy-btn--install" data-copy="<?php echo esc_attr($grwi_created_shortcode); ?>">
                                    <?php esc_html_e('Copy', 'gr-widget'); ?>
                                </button>
                            </div>
                        </div>
                        <div class="grw-create-result__actions">
                            <?php if ($grwi_created_customize_url !== '') : ?>
                                <a class="button button-primary" href="<?php echo esc_url($grwi_created_customize_url); ?>">
                                    <?php esc_html_e('Customize', 'gr-widget'); ?>
                                </a>
                            <?php endif; ?>
                        </div>
                    </div>
                <?php endif; ?>

                <div class="grw-panel__header grw-panel__header--create<?php echo $grwi_widget_count === 0 ? ' grw-panel__header--first' : ''; ?>">
                    <div>
                        <?php if ($grwi_widget_count === 0) : ?>
                            <div class="grw-first-widget">
                                <span class="grw-first-widget__art" aria-hidden="true">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56" fill="none">
                                        <rect x="2" y="12" width="52" height="38" rx="9" fill="#FFFFFF" stroke="#C9D8F0" stroke-width="1.75"/>
                                        <rect x="9" y="20" width="22" height="5" rx="2.5" fill="#DCE7FA"/>
                                        <rect x="9" y="40" width="30" height="3.5" rx="1.75" fill="#E8EEF9"/>
                                        <g fill="#F5B301">
                                            <path d="M11.5 27.4l1.6 3.2 3.5.5-2.5 2.5.6 3.5-3.2-1.7-3.2 1.7.6-3.5-2.5-2.5 3.5-.5z"/>
                                            <path d="M22.5 27.4l1.6 3.2 3.5.5-2.5 2.5.6 3.5-3.2-1.7-3.2 1.7.6-3.5-2.5-2.5 3.5-.5z"/>
                                            <path d="M33.5 27.4l1.6 3.2 3.5.5-2.5 2.5.6 3.5-3.2-1.7-3.2 1.7.6-3.5-2.5-2.5 3.5-.5z"/>
                                            <path d="M44.5 27.4l1.6 3.2 3.5.5-2.5 2.5.6 3.5-3.2-1.7-3.2 1.7.6-3.5-2.5-2.5 3.5-.5z"/>
                                        </g>
                                        <circle cx="44" cy="13" r="10" fill="#FFFFFF" stroke="#C9D8F0" stroke-width="1.75"/>
                                        <g transform="translate(37.4 6.4) scale(0.55)">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                        </g>
                                    </svg>
                                </span>
                                <div class="grw-first-widget__copy">
                                    <h2 id="grwi-create-heading" class="grw-first-widget__title"><?php esc_html_e('Create your first Google reviews widget', 'gr-widget'); ?></h2>
                                    <p class="grw-first-widget__text">
                                        <?php esc_html_e('Find your business, choose a layout, and add your reviews to your website.', 'gr-widget'); ?><br>
                                        <?php esc_html_e('No Google sign-in or API key required.', 'gr-widget'); ?>
                                    </p>
                                </div>
                            </div>
                        <?php elseif (! empty($can_create)) : ?>
                            <h2 id="grwi-create-heading" class="grw-panel__title"><?php esc_html_e('Add widget', 'gr-widget'); ?></h2>
                            <p class="grw-panel__subtitle"><?php esc_html_e('Search for your business by name — no Google sign-in or API keys required.', 'gr-widget'); ?></p>
                        <?php else : ?>
                            <h2 id="grwi-create-heading" class="grw-panel__title"><?php esc_html_e('Explore layouts', 'gr-widget'); ?></h2>
                            <p class="grw-panel__subtitle"><?php echo $is_linked
                                ? esc_html__('Browse the layouts available for your next widget. Upgrade above when you’re ready to create it.', 'gr-widget')
                                : esc_html__('Browse the layouts available for your next widget. Link your free account above when you’re ready to create it.', 'gr-widget'); ?></p>
                        <?php endif; ?>
                    </div>
                    <?php if ($grwi_widget_count > 0) : ?>
                        <button type="button" class="grw-create-panel__hide" id="grwi-create-panel-hide">
                            <?php esc_html_e('Hide', 'gr-widget'); ?>
                        </button>
                    <?php endif; ?>
                </div>

                <div id="grwi-sync-notice" class="grw-sync-notice" hidden role="status" aria-live="polite">
                    <div class="grw-sync-notice__inner">
                        <span class="grw-spinner grw-sync-notice__spinner" aria-hidden="true"></span>
                        <div class="grw-sync-notice__content">
                            <p class="grw-sync-notice__title" id="grwi-sync-notice-title"><?php esc_html_e('Syncing reviews in the background', 'gr-widget'); ?></p>
                            <p class="grw-sync-notice__hint" id="grwi-sync-notice-hint"><?php esc_html_e('You can continue building your widget — live review data will appear in the preview shortly.', 'gr-widget'); ?></p>
                        </div>
                        <button type="button" class="button button-secondary grw-sync-notice__retry" id="grwi-sync-notice-retry" hidden>
                            <?php esc_html_e('Try again', 'gr-widget'); ?>
                        </button>
                        <button type="button" class="grw-sync-notice__dismiss" id="grwi-sync-notice-dismiss" aria-label="<?php esc_attr_e('Dismiss notice', 'gr-widget'); ?>">&times;</button>
                    </div>
                </div>
                <div id="grwi-sync-toast" class="grw-sync-toast" hidden role="alert" aria-live="assertive">
                    <span class="grw-sync-toast__icon dashicons dashicons-yes-alt" aria-hidden="true"></span>
                    <p class="grw-sync-toast__text" id="grwi-sync-toast-text"></p>
                </div>

                <?php
                $grwi_render_layout_card = static function ($grwi_key, $layout_meta, $grwi_layout_preview_theme, $default_layout, $can_create_widget) {
                    if (! isset($layout_meta[$grwi_key])) {
                        return;
                    }
                    $grwi_layout = $layout_meta[$grwi_key];
                    $grwi_label = sanitize_text_field($grwi_layout['label'] ?? $grwi_key);
                    $grwi_family = sanitize_key($grwi_layout['family'] ?? 'badge');
                    $grwi_locked = ! empty($grwi_layout['locked']);
                    $grwi_entitlement = sanitize_key($grwi_layout['entitlement'] ?? '');
                    if ($grwi_entitlement === '' || $grwi_entitlement === 'link_account') {
                        $grwi_legacy_lock_tier = sanitize_key($grwi_layout['lock_tier'] ?? '');
                        if ($grwi_legacy_lock_tier === 'link_account' || $grwi_entitlement === 'link_account') {
                            $grwi_entitlement = 'linked_free';
                        } elseif ($grwi_legacy_lock_tier === 'site') {
                            $grwi_entitlement = 'site';
                        } elseif ($grwi_locked) {
                            $grwi_entitlement = 'site';
                        } else {
                            $grwi_entitlement = 'unlinked';
                        }
                    }
                    /* translators: %s: layout name */
                    $grwi_layout_preview_title = __('Layout preview: %s', 'gr-widget');
                    $grwi_badge = '';
                    $grwi_badge_class = 'grw-admin-badge--site';
                    $grwi_icon_class = 'grw-layout-card__icon--lock';
                    $grwi_hover_hint = '';
                    if ($grwi_entitlement === 'linked_free') {
                        $grwi_badge = __('FREE WITH ACCOUNT', 'gr-widget');
                        $grwi_badge_class = 'grw-admin-badge--free-account';
                        $grwi_icon_class = 'grw-layout-card__icon--account';
                        $grwi_hover_hint = __('Link free account', 'gr-widget');
                    } elseif ($grwi_entitlement === 'business') {
                        $grwi_badge = __('BUSINESS PLAN', 'gr-widget');
                        $grwi_badge_class = 'grw-admin-badge--site';
                        $grwi_icon_class = 'grw-layout-card__icon--lock';
                        $grwi_hover_hint = __('View Business plan', 'gr-widget');
                    } elseif ($grwi_entitlement === 'site' || $grwi_locked) {
                        $grwi_badge = __('SITE PLAN', 'gr-widget');
                        $grwi_badge_class = 'grw-admin-badge--site';
                        $grwi_icon_class = 'grw-layout-card__icon--lock';
                        $grwi_hover_hint = __('Start free trial', 'gr-widget');
                    }

                    // Plan entitlement lock only — never restyle included layouts for widget-count limits.
                    if ($grwi_locked) {
                        $grwi_lock_class = $grwi_entitlement !== '' ? (' grw-layout-card--entitlement-' . $grwi_entitlement) : '';
                        $grwi_data_entitlement = $grwi_entitlement !== '' ? $grwi_entitlement : 'site';
                        $grwi_upgrade_plan = sanitize_text_field($grwi_layout['upgrade_plan'] ?? '');
                        if ($grwi_upgrade_plan === '' && $grwi_data_entitlement === 'business') {
                            $grwi_upgrade_plan = 'Business';
                        } elseif ($grwi_upgrade_plan === '' && $grwi_data_entitlement === 'site') {
                            $grwi_upgrade_plan = 'Site';
                        }
                        ?>
                        <div
                            class="grw-layout-card grw-layout-card--locked<?php echo esc_attr($grwi_lock_class); ?>"
                            data-layout="<?php echo esc_attr($grwi_key); ?>"
                            data-layout-label="<?php echo esc_attr($grwi_label); ?>"
                            data-entitlement="<?php echo esc_attr($grwi_data_entitlement); ?>"
                            data-upgrade-plan="<?php echo esc_attr($grwi_upgrade_plan); ?>"
                            role="button"
                            tabindex="0"
                        >
                            <span class="grw-layout-card__header" aria-hidden="true">
                                <?php if ($grwi_badge !== '') : ?>
                                    <span class="grw-layout-card__pill grw-admin-badge <?php echo esc_attr($grwi_badge_class); ?>"><?php echo esc_html($grwi_badge); ?></span>
                                <?php endif; ?>
                                <span class="grw-layout-card__previewing-pill"><?php echo $grwi_entitlement === 'linked_free'
                                    ? esc_html__('PREVIEWING · FREE ACCOUNT REQUIRED', 'gr-widget')
                                    : ($grwi_entitlement === 'business'
                                        ? esc_html__('PREVIEWING · BUSINESS PLAN', 'gr-widget')
                                        : esc_html__('PREVIEWING · SITE PLAN', 'gr-widget')); ?></span>
                                <span class="grw-layout-card__icon <?php echo esc_attr($grwi_icon_class); ?>"></span>
                            </span>
                            <span class="grw-layout-card__preview grw-layout-card__preview--theme-<?php echo esc_attr($grwi_layout_preview_theme); ?> grw-layout-card__preview--<?php echo esc_attr($grwi_family); ?> grw-layout-card__preview--<?php echo esc_attr($grwi_key); ?>">
                                <span
                                    class="grw-layout-card__mock"
                                    data-layout="<?php echo esc_attr($grwi_key); ?>"
                                    data-preview-theme="<?php echo esc_attr($grwi_layout_preview_theme); ?>"
                                    role="img"
                                    aria-label="<?php echo esc_attr(sprintf($grwi_layout_preview_title, $grwi_label)); ?>"
                                >
                                    <span class="grw-layout-card__stage" data-grw-layout-stage aria-hidden="true">
                                        <span class="grw-layout-card__target" data-grw-layout-target></span>
                                    </span>
                                </span>
                            </span>
                            <span class="grw-layout-card__label"><?php echo esc_html($grwi_label); ?></span>
                            <?php if ($grwi_hover_hint !== '') : ?>
                                <span class="grw-layout-card__hover-hint"><?php echo esc_html($grwi_hover_hint); ?></span>
                            <?php endif; ?>
                        </div>
                        <?php
                        return;
                    }

                    // Included layout while widget allowance is full: full-colour browse, no Selected/lock.
                    if (! $can_create_widget) {
                        ?>
                        <div
                            class="grw-layout-card grw-layout-card--browse"
                            data-layout="<?php echo esc_attr($grwi_key); ?>"
                            data-layout-label="<?php echo esc_attr($grwi_label); ?>"
                            data-entitlement="<?php echo esc_attr($grwi_entitlement !== '' ? $grwi_entitlement : 'unlinked'); ?>"
                            data-allowance-full="1"
                            role="button"
                            tabindex="0"
                        >
                            <span class="grw-layout-card__header" aria-hidden="true"></span>
                            <span class="grw-layout-card__preview grw-layout-card__preview--theme-<?php echo esc_attr($grwi_layout_preview_theme); ?> grw-layout-card__preview--<?php echo esc_attr($grwi_family); ?> grw-layout-card__preview--<?php echo esc_attr($grwi_key); ?>" aria-hidden="true">
                                <span
                                    class="grw-layout-card__mock"
                                    data-layout="<?php echo esc_attr($grwi_key); ?>"
                                    data-preview-theme="<?php echo esc_attr($grwi_layout_preview_theme); ?>"
                                    role="img"
                                    aria-label="<?php echo esc_attr(sprintf($grwi_layout_preview_title, $grwi_label)); ?>"
                                >
                                    <span class="grw-layout-card__stage" data-grw-layout-stage aria-hidden="true">
                                        <span class="grw-layout-card__target" data-grw-layout-target></span>
                                    </span>
                                </span>
                            </span>
                            <span class="grw-layout-card__label"><?php echo esc_html($grwi_label); ?></span>
                        </div>
                        <?php
                        return;
                    }

                    $grwi_is_selected = $grwi_key === $default_layout;
                    ?>
                    <label class="grw-layout-card grw-layout-card--selectable<?php echo $grwi_is_selected ? ' grw-layout-card--selected' : ''; ?>" data-layout="<?php echo esc_attr($grwi_key); ?>" data-layout-label="<?php echo esc_attr($grwi_label); ?>" data-entitlement="<?php echo esc_attr($grwi_entitlement); ?>">
                        <input
                            type="radio"
                            name="grwi_layout_pick"
                            value="<?php echo esc_attr($grwi_key); ?>"
                            class="grw-layout-card__input"
                            <?php checked($grwi_is_selected); ?>
                        />
                        <span class="grw-layout-card__header" aria-hidden="true">
                            <span class="grw-layout-card__selected-pill"><?php echo esc_html__('✓ SELECTED', 'gr-widget'); ?></span>
                        </span>
                        <span class="grw-layout-card__preview grw-layout-card__preview--theme-<?php echo esc_attr($grwi_layout_preview_theme); ?> grw-layout-card__preview--<?php echo esc_attr($grwi_family); ?> grw-layout-card__preview--<?php echo esc_attr($grwi_key); ?>" aria-hidden="true">
                            <span
                                class="grw-layout-card__mock"
                                data-layout="<?php echo esc_attr($grwi_key); ?>"
                                data-preview-theme="<?php echo esc_attr($grwi_layout_preview_theme); ?>"
                                role="img"
                                aria-label="<?php echo esc_attr(sprintf($grwi_layout_preview_title, $grwi_label)); ?>"
                            >
                                <span class="grw-layout-card__stage" data-grw-layout-stage aria-hidden="true">
                                    <span class="grw-layout-card__target" data-grw-layout-target></span>
                                </span>
                            </span>
                        </span>
                        <span class="grw-layout-card__label"><?php echo esc_html($grwi_label); ?></span>
                    </label>
                    <?php
                };

                $grwi_render_layout_sections = static function ($sections, $layout_meta, $theme, $default_layout, $can_create_widget) use ($grwi_render_layout_card) {
                    foreach ($sections as $grwi_section_key => $grwi_section) {
                        $grwi_section_layouts = array_values(array_filter(
                            $grwi_section['layouts'] ?? [],
                            static fn (string $grwi_key): bool => isset($layout_meta[$grwi_key])
                        ));
                        if ($grwi_section_layouts === []) {
                            continue;
                        }
                        $grwi_section_slug = sanitize_key((string) ($grwi_section['key'] ?? ''));
                        if ($grwi_section_slug === '' && is_string($grwi_section_key) && ! is_numeric($grwi_section_key)) {
                            $grwi_section_slug = sanitize_key($grwi_section_key);
                        }
                        if ($grwi_section_slug === '' && stripos((string) ($grwi_section['title'] ?? ''), 'badge') !== false) {
                            $grwi_section_slug = 'badges';
                        }
                        ?>
                        <section
                            class="grw-layout-category"
                            <?php if ($grwi_section_slug !== '') : ?>
                                id="grwi-layout-section-<?php echo esc_attr($grwi_section_slug); ?>"
                                data-layout-section="<?php echo esc_attr($grwi_section_slug); ?>"
                            <?php endif; ?>
                            aria-label="<?php echo esc_attr($grwi_section['title'] ?? ''); ?>"
                        >
                            <?php if (! empty($grwi_section['title']) || ! empty($grwi_section['hint'])) : ?>
                                <header class="grw-layout-category__head">
                                    <?php if (! empty($grwi_section['title'])) : ?>
                                        <p class="grw-layout-category__title"><?php echo esc_html($grwi_section['title']); ?></p>
                                    <?php endif; ?>
                                    <?php if (! empty($grwi_section['hint'])) : ?>
                                        <p class="grw-layout-category__hint"><?php echo esc_html($grwi_section['hint']); ?></p>
                                    <?php endif; ?>
                                </header>
                            <?php endif; ?>
                            <div class="grw-layout-picker">
                                <?php foreach ($grwi_section_layouts as $grwi_key) : ?>
                                    <?php $grwi_render_layout_card($grwi_key, $layout_meta, $theme, $default_layout, $can_create_widget); ?>
                                <?php endforeach; ?>
                            </div>
                        </section>
                        <?php
                    }
                };

                $grwi_sections_for_picker = ! empty($picker_layout_sections) ? $picker_layout_sections : $free_layout_sections;
                $grwi_render_layout_filters = static function (): void {
                    $grwi_filters = [
                        'all' => __('All layouts', 'gr-widget'),
                        'badges' => __('Badges & ratings', 'gr-widget'),
                        'carousels' => __('Carousels & sliders', 'gr-widget'),
                        'grids' => __('Grids & lists', 'gr-widget'),
                        'highlights' => __('Review highlights', 'gr-widget'),
                        'stickers' => __('Stickers', 'gr-widget'),
                    ];
                    ?>
                    <div class="grw-layout-filters" role="tablist" aria-label="<?php esc_attr_e('Filter layouts', 'gr-widget'); ?>">
                        <?php foreach ($grwi_filters as $grwi_filter_key => $grwi_filter_label) : ?>
                            <button
                                type="button"
                                class="grw-layout-filters__btn<?php echo $grwi_filter_key === 'all' ? ' is-active' : ''; ?>"
                                role="tab"
                                aria-selected="<?php echo $grwi_filter_key === 'all' ? 'true' : 'false'; ?>"
                                data-grwi-layout-filter="<?php echo esc_attr($grwi_filter_key); ?>"
                            ><?php echo esc_html($grwi_filter_label); ?></button>
                        <?php endforeach; ?>
                    </div>
                    <?php
                };
                ?>

                <?php if (! $can_create) : ?>
                    <?php $grwi_render_layout_filters(); ?>
                    <div class="grw-layout-categories" role="group" aria-label="<?php echo esc_attr__('Layouts', 'gr-widget'); ?>">
                        <?php $grwi_render_layout_sections($grwi_sections_for_picker, $layout_meta, $grwi_layout_preview_theme, $default_layout, false); ?>
                    </div>
                <?php else : ?>
                    <form method="post" class="grw-create-form" id="grwi-create-form">
                        <?php wp_nonce_field('grwi_admin_action'); ?>
                        <input type="hidden" name="grwi_action" value="create_widget" />
                        <input type="hidden" name="place_id" id="grwi-place-id" required />
                        <input type="hidden" name="business_name" id="grwi-business-name" required />
                        <input type="hidden" name="formatted_address" id="grwi-formatted-address" />
                        <input type="hidden" name="rating" id="grwi-rating" />
                        <input type="hidden" name="review_count" id="grwi-review-count" />
                        <input type="hidden" name="layout" id="grwi-layout" value="<?php echo esc_attr($default_layout); ?>" />

                        <div class="grw-field grw-field--place-search">
                            <div class="grw-search-lead">
                            <label class="grw-field__label" for="grwi-place-search"><?php esc_html_e('Find your business on Google', 'gr-widget'); ?></label>
                            <div class="grw-search-stack">
                                <div class="grw-search" id="grwi-search-wrap">
                                    <span class="dashicons dashicons-search grw-search__icon" aria-hidden="true"></span>
                                    <input
                                        type="search"
                                        id="grwi-place-search"
                                        class="grw-search__input"
                                        placeholder="<?php esc_attr_e('Start typing your business name…', 'gr-widget'); ?>"
                                        autocomplete="off"
                                        aria-autocomplete="list"
                                        aria-controls="grw-place-results"
                                        aria-expanded="false"
                                        aria-describedby="grwi-create-business-hint grwi-place-error"
                                    />
                                </div>
                                <div id="grwi-place-results" class="grw-place-results" hidden role="listbox" aria-live="polite"></div>
                            </div>
                            </div>
                            <p id="grwi-create-business-hint" class="grw-field__hint"><?php esc_html_e('Select a business to continue', 'gr-widget'); ?></p>
                            <p id="grwi-place-error" class="grw-field-error" hidden role="alert"></p>
                            <div id="grwi-business-required-notice" class="grw-inline-notice" hidden role="status">
                                <div class="grw-inline-notice__icon" aria-hidden="true">i</div>
                                <div class="grw-inline-notice__copy">
                                    <p class="grw-inline-notice__title"><?php esc_html_e('Select your Google business first', 'gr-widget'); ?></p>
                                    <p class="grw-inline-notice__text"><?php esc_html_e('Search for and select your business above. You can then preview and customise any layout, including locked layouts, before you publish.', 'gr-widget'); ?></p>
                                </div>
                                <button type="button" class="grw-inline-notice__dismiss" data-grwi-dismiss-business-notice aria-label="<?php esc_attr_e('Dismiss', 'gr-widget'); ?>">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div id="grwi-recent-places" class="grw-recent-places" hidden>
                                <p class="grw-recent-places__label"><?php esc_html_e('Your businesses', 'gr-widget'); ?></p>
                                <div class="grw-recent-places__list" id="grwi-recent-places-list" role="list"></div>
                            </div>
                            <div id="grwi-selected-place" class="grw-selected-place" hidden role="status">
                                <span class="dashicons dashicons-yes-alt" aria-hidden="true"></span>
                                <span id="grwi-selected-place-text"></span>
                                <button type="button" class="grw-selected-place__clear" id="grwi-clear-place" aria-label="<?php esc_attr_e('Clear selected business', 'gr-widget'); ?>">&times;</button>
                            </div>
                            <div id="grwi-review-sync" class="grwi-review-sync" hidden></div>
                        </div>

                        <div class="grw-field">
                            <span class="grw-field__label" id="grwi-layout-label"><?php echo $grwi_widget_count === 0
                                ? esc_html__('Choose a layout', 'gr-widget')
                                : esc_html__('Layout', 'gr-widget'); ?></span>
                            <?php if ($grwi_widget_count === 0) : ?>
                                <p class="grw-field__hint grw-field__hint--layout"><?php esc_html_e('Pick a design that fits your website. You can customise everything after adding your reviews.', 'gr-widget'); ?></p>
                            <?php endif; ?>
                            <?php $grwi_render_layout_filters(); ?>
                            <div class="grw-layout-categories" role="radiogroup" aria-labelledby="grwi-layout-label">
                                <?php $grwi_render_layout_sections($grwi_sections_for_picker, $layout_meta, $grwi_layout_preview_theme, $default_layout, true); ?>
                            </div>
                            <p class="grw-field__hint" id="grwi-layout-hint"></p>
                        </div>

                        <div id="grwi-wp-live-preview" class="grw-live-preview" hidden>
                            <div class="grw-live-preview__head">
                                <div class="grw-live-preview__intro">
                                    <h3 class="grw-live-preview__title" id="grwi-live-preview-title"><?php esc_html_e('Live preview', 'gr-widget'); ?></h3>
                                    <p class="grw-live-preview__sub" id="grwi-live-preview-sub"><?php esc_html_e('Preview uses your business name and rating with demo reviews until sync completes.', 'gr-widget'); ?></p>
                                </div>
                                <div id="grwi-live-preview-notice" class="grw-live-preview__notice" hidden role="status">
                                    <span class="grw-live-preview__notice-icon" aria-hidden="true">i</span>
                                    <div class="grw-live-preview__notice-copy">
                                        <p id="grwi-live-preview-notice-title" class="grw-live-preview__notice-title"></p>
                                        <p id="grwi-live-preview-notice-text" class="grw-live-preview__notice-text"></p>
                                    </div>
                                </div>
                            </div>
                            <div class="grw-live-preview__stage">
                                <div id="grwi-wp-live-preview-target" class="grw-live-preview__target"></div>
                            </div>
                        </div>

                        <div class="grw-create-form__submit-wrap" id="grwi-create-submit-wrap">
                            <?php submit_button(__('Create widget', 'gr-widget'), 'primary grw-submit', 'submit', false); ?>
                            <button type="button" class="grw-btn grw-btn--outline" id="grwi-pick-another-layout" hidden>
                                <svg class="grw-btn__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
                                    <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <span><?php esc_html_e('Choose an available layout', 'gr-widget'); ?></span>
                            </button>
                            <div class="grw-live-preview__cta" id="grwi-locked-preview-cta-wrap" hidden>
                                <button type="button" class="grw-btn grw-btn--locked-cta" id="grwi-locked-preview-cta">
                                    <span id="grwi-locked-preview-cta-label"><?php esc_html_e('View Site plan to use this layout', 'gr-widget'); ?></span>
                                    <svg class="grw-btn__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
                                        <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </button>
                                <p class="grw-live-preview__cta-note" id="grwi-locked-preview-supporting">
                                    <span class="grw-live-preview__cta-lock" aria-hidden="true"></span>
                                    <span id="grwi-locked-preview-supporting-text"></span>
                                </p>
                            </div>
                            <div class="grw-create-form__overlay" aria-hidden="true">
                                <span class="grw-spinner" aria-hidden="true"></span>
                                <span><?php esc_html_e('Creating widget…', 'gr-widget'); ?></span>
                            </div>
                        </div>
                    </form>
                <?php endif; ?>
            </section>
        </main>

        <aside class="grw-sidebar">
            <section id="grwi-preview-rail" class="grw-preview-rail" hidden aria-live="polite">
                <h3 class="grw-preview-rail__title" id="grwi-preview-rail-title"></h3>
                <p class="grw-preview-rail__body" id="grwi-preview-rail-body"></p>
                <p class="grw-preview-rail__actions">
                    <button type="button" class="button button-primary grw-preview-rail__cta" id="grwi-preview-rail-cta"></button>
                </p>
            </section>
            <div class="grw-account-slot">
            <details class="grw-account<?php echo $is_linked ? '' : ' grw-account--link-promo'; ?>"<?php echo $is_linked ? '' : ' open'; ?>>
                <summary class="grw-account__summary">
                    <img class="grw-account__logo" src="<?php echo esc_url(GRWI_PLUGIN_URL . 'assets/logo-icon.png'); ?>" alt="" width="18" height="18" />
                    <span class="grw-account__title"><?php esc_html_e('Account', 'gr-widget'); ?></span>
                    <?php if ($is_linked) : ?>
                        <span class="grw-account__status grw-account__status--linked">
                            <span class="grw-account__status-check" aria-hidden="true">✓</span>
                            <?php esc_html_e('Linked', 'gr-widget'); ?>
                        </span>
                    <?php else : ?>
                        <span class="grw-account__status grw-account__status--upgrade"><?php esc_html_e('FREE UPGRADE', 'gr-widget'); ?></span>
                    <?php endif; ?>
                </summary>
                <div class="grw-account__body">
                    <?php if ($is_linked) : ?>
                        <?php
                        $grwi_site_host = (string) (wp_parse_url(home_url('/'), PHP_URL_HOST) ?: home_url('/'));
                        $grwi_included_widgets = $grwi_max_widgets === null
                            ? __('Unlimited widgets', 'gr-widget')
                            : sprintf(
                                /* translators: %d: max widgets on plan */
                                _n('%d widget', '%d widgets', (int) $grwi_max_widgets, 'gr-widget'),
                                (int) $grwi_max_widgets
                            );
                        $grwi_included_reviews = $grwi_max_reviews === null
                            ? __('Unlimited reviews', 'gr-widget')
                            : sprintf(
                                /* translators: %d: max reviews per widget */
                                _n('%d review', '%d reviews', (int) $grwi_max_reviews, 'gr-widget'),
                                (int) $grwi_max_reviews
                            );
                        $grwi_layout_count = is_array($caps['limits']['layouts'] ?? null)
                            ? count($caps['limits']['layouts'])
                            : 8;
                        $grwi_included_layouts = sprintf(
                            /* translators: %d: number of layouts */
                            _n('%d layout', '%d layouts', $grwi_layout_count, 'gr-widget'),
                            $grwi_layout_count
                        );
                        $grwi_plan_label = $grwi_linked_plan_name !== '' ? $grwi_linked_plan_name : __('Free', 'gr-widget');
                        ?>
                        <h3 class="grw-account__heading"><?php esc_html_e('Connected to GR Widget', 'gr-widget'); ?></h3>
                        <p class="grw-account__text">
                            <?php
                            printf(
                                /* translators: %s: plan name */
                                esc_html__('This site and its widgets are connected to your %s account.', 'gr-widget'),
                                esc_html($grwi_plan_label)
                            );
                            ?>
                        </p>
                        <table class="grw-account__table">
                            <tbody>
                                <tr>
                                    <th scope="row"><?php esc_html_e('Plan', 'gr-widget'); ?></th>
                                    <td><?php echo esc_html($grwi_plan_label); ?></td>
                                </tr>
                                <tr>
                                    <th scope="row"><?php esc_html_e('Site', 'gr-widget'); ?></th>
                                    <td><?php echo esc_html($grwi_site_host); ?></td>
                                </tr>
                                <?php if ($grwi_google_label !== '') : ?>
                                <tr>
                                    <th scope="row"><?php esc_html_e('Google businesses', 'gr-widget'); ?></th>
                                    <td><?php echo esc_html($grwi_google_label); ?></td>
                                </tr>
                                <?php endif; ?>
                                <tr>
                                    <th scope="row"><?php esc_html_e('Included', 'gr-widget'); ?></th>
                                    <td><?php echo esc_html($grwi_included_widgets . ' · ' . $grwi_included_reviews . ' · ' . $grwi_included_layouts); ?></td>
                                </tr>
                            </tbody>
                        </table>
                        <p>
                            <a class="button button-secondary grw-account__dashboard" href="<?php echo esc_url($grwi_billing_url); ?>" target="_blank" rel="noopener noreferrer">
                                <?php esc_html_e('Open web dashboard', 'gr-widget'); ?> →
                            </a>
                        </p>
                        <p class="grw-account__manage">
                            <button type="button" class="button-link grw-account__manage-toggle" data-grwi-manage-connection aria-expanded="false" aria-controls="grwi-manage-connection">
                                <?php esc_html_e('Manage connection', 'gr-widget'); ?>
                            </button>
                        </p>
                        <div id="grwi-manage-connection" class="grw-account__manage-panel" hidden>
                            <form method="post" class="grw-unlink-form" id="grwi-unlink-form">
                                <?php wp_nonce_field('grwi_admin_action'); ?>
                                <input type="hidden" name="grwi_action" value="unlink_account" />
                                <?php submit_button(__('Unlink account', 'gr-widget'), 'delete', 'grwi_unlink', false); ?>
                            </form>
                        </div>
                        <p class="grw-account__footnote">
                            <span class="grw-account__footnote-icon" aria-hidden="true">✓</span>
                            <span class="grw-account__footnote-text"><?php esc_html_e('Plan limits sync automatically', 'gr-widget'); ?></span>
                        </p>
                    <?php else : ?>
                        <?php
                        $grwi_link_benefit_allowed = [
                            'strong' => [
                                'class' => true,
                            ],
                        ];
                        $grwi_render_link_benefit = static function (string $html) use ($grwi_link_benefit_allowed): void {
                            ?>
                            <li class="grw-account-link__benefit">
                                <span class="grw-account-link__tick" aria-hidden="true">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="12" height="12" fill="none">
                                        <path d="M3.2 8.3l3 3.1 6.6-6.8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </span>
                                <span class="grw-account-link__benefit-text"><?php echo wp_kses($html, $grwi_link_benefit_allowed); ?></span>
                            </li>
                            <?php
                        };
                        ?>
                        <div class="grw-account-link">
                            <header class="grw-account-link__head">
                                <h3 class="grw-account-link__title">
                                    <span class="grw-account-link__title-line"><?php esc_html_e('Get more from GR Widget.', 'gr-widget'); ?></span>
                                    <span class="grw-account-link__title-accent"><?php esc_html_e('For free.', 'gr-widget'); ?></span>
                                </h3>
                                <p class="grw-account-link__lede"><?php esc_html_e('Linking is free. Create a free GR Widget account to instantly upgrade this plugin. Your existing widgets and shortcodes stay in place.', 'gr-widget'); ?></p>
                                <ul class="grw-account-link__benefits">
                                    <?php
                                    $grwi_render_link_benefit(
                                        '<strong class="grw-account-link__gain">' . esc_html__('3 widgets', 'gr-widget') . '</strong> '
                                        . esc_html__('instead of', 'gr-widget')
                                        . ' <strong class="grw-account-link__was">1</strong>'
                                    );
                                    $grwi_render_link_benefit(
                                        '<strong class="grw-account-link__gain">' . esc_html__('10 reviews', 'gr-widget') . '</strong> '
                                        . esc_html__('instead of', 'gr-widget')
                                        . ' <strong class="grw-account-link__was">5</strong>'
                                    );
                                    $grwi_render_link_benefit(
                                        '<strong class="grw-account-link__gain">' . esc_html__('22 layouts', 'gr-widget') . '</strong> '
                                        . esc_html__('instead of', 'gr-widget')
                                        . ' <strong class="grw-account-link__was">5</strong>'
                                    );
                                    $grwi_render_link_benefit('<strong class="grw-account-link__was">' . esc_html__('Cloud backup', 'gr-widget') . '</strong>');
                                    $grwi_render_link_benefit('<strong class="grw-account-link__was">' . esc_html__('Web dashboard', 'gr-widget') . '</strong>');
                                    ?>
                                </ul>
                            </header>
                            <p class="grw-account-link__actions">
                                <button type="button" class="button button-primary grw-account__connect grw-account-link__cta" data-grwi-connect-account>
                                    <?php esc_html_e('Unlock free features', 'gr-widget'); ?>
                                    <span class="grw-account-link__cta-arrow" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="16" height="16" fill="none">
                                            <path d="M4 10h11M11.5 5.5L16 10l-4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </span>
                                </button>
                            </p>
                            <p class="grw-account-link__meta">
                                <span class="grw-account-link__meta-line">
                                    <span class="grw-account-link__meta-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none">
                                            <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </span>
                                    <span><?php esc_html_e('Free forever', 'gr-widget'); ?></span>
                                    <span class="grw-account-link__dot" aria-hidden="true">•</span>
                                    <span><?php esc_html_e('No card required.', 'gr-widget'); ?></span>
                                </span>
                                <span class="grw-account-link__meta-line">
                                    <span class="grw-account-link__meta-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="14" height="14" fill="none">
                                            <path d="M10 5.5V10l2.75 1.75M17.5 10a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </span>
                                    <span><?php esc_html_e('Takes ~20 seconds', 'gr-widget'); ?></span>
                                </span>
                            </p>
                            <button type="button" class="grw-account-link__existing" data-grwi-connect-account>
                                <span class="grw-account-link__existing-icon" aria-hidden="true">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none">
                                        <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </span>
                                <span><?php esc_html_e('Already have an account?', 'gr-widget'); ?> <?php esc_html_e('Link it here', 'gr-widget'); ?></span>
                            </button>
                            <p class="grw-account-link__status" data-grwi-connect-status aria-live="polite"></p>
                            <p class="grw-account-link__footnote">
                                <span class="grw-account-link__footnote-icon" aria-hidden="true">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none">
                                        <path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </span>
                                <span class="grw-account-link__footnote-text"><?php esc_html_e('Secure connection • Returns you to WordPress automatically', 'gr-widget'); ?></span>
                            </p>
                        </div>
                    <?php endif; ?>
                </div>
            </details>
            </div>

            <?php if ($show_paid_upgrade_ui) : ?>
                <?php
                $grwi_render_sidebar_upgrade_benefit = static function (string $feature, string $detail = ''): void {
                    ?>
                    <li class="grw-layout-upgrade__benefit">
                        <span class="grw-layout-upgrade__tick" aria-hidden="true">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none">
                                <circle cx="10" cy="10" r="10" fill="currentColor"/>
                                <path d="M6 10.2l2.4 2.4L14 7.2" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </span>
                        <span class="grw-layout-upgrade__benefit-text">
                            <strong class="grw-layout-upgrade__benefit-feature"><?php echo esc_html($feature); ?></strong>
                            <?php if ($detail !== '') : ?>
                                <span class="grw-layout-upgrade__benefit-detail"><?php echo esc_html($detail); ?></span>
                            <?php endif; ?>
                        </span>
                    </li>
                    <?php
                };
                ?>
                <?php
                $grwi_business_trial_copy = is_array($caps['trial_copy']['business'] ?? null) ? $caps['trial_copy']['business'] : [];
                $grwi_business_trial_url = trim((string) ($caps['business_trial_url'] ?? ''));
                if ($grwi_business_trial_url === '') {
                    $grwi_business_trial_url = 'https://grwidget.com/pricing?source=wordpress&plan=business&cycle=monthly';
                }
                if (! $is_linked && (int) ($site_id ?? 0) > 0) {
                    $grwi_business_trial_url = add_query_arg('site_id', (int) $site_id, $grwi_business_trial_url);
                }
                $grwi_sidebar_plans = [
                    'site' => [
                        'title' => $grwi_trial_eligible === false
                            ? __('Upgrade to Site', 'gr-widget')
                            : __('Try Site free for 7 days', 'gr-widget'),
                        'lede' => $grwi_trial_eligible === false
                            ? (string) ($grwi_site_trial_copy['ineligible_supporting'] ?? __('Charged at checkout. Cancel anytime.', 'gr-widget'))
                            : (string) ($grwi_site_trial_copy['eligible_supporting'] ?? __('$0 today. Your first payment of $5.99 is after 7 days unless you cancel.', 'gr-widget')),
                        'cta' => $grwi_trial_eligible === false
                            ? (string) ($grwi_site_trial_copy['ineligible_cta'] ?? __('Upgrade to Site', 'gr-widget'))
                            : __('Start 7-day Site trial', 'gr-widget'),
                        'url' => $grwi_trial_url,
                        'benefits' => [
                            __('Unlimited widgets', 'gr-widget'),
                            __('Up to 30 reviews', 'gr-widget'),
                            __('Reviewer avatar photos', 'gr-widget'),
                            __('Every layout', 'gr-widget'),
                            __('Advanced customisation', 'gr-widget'),
                        ],
                    ],
                    'business' => [
                        'title' => $grwi_trial_eligible === false
                            ? __('Upgrade to Business', 'gr-widget')
                            : __('Try Business free for 7 days', 'gr-widget'),
                        'lede' => $grwi_trial_eligible === false
                            ? (string) ($grwi_business_trial_copy['ineligible_supporting'] ?? __('Charged at checkout. Cancel anytime.', 'gr-widget'))
                            : (string) ($grwi_business_trial_copy['eligible_supporting'] ?? __('$0 today. Your first payment of $14.99 is after 7 days unless you cancel.', 'gr-widget')),
                        'cta' => $grwi_trial_eligible === false
                            ? (string) ($grwi_business_trial_copy['ineligible_cta'] ?? __('Upgrade to Business', 'gr-widget'))
                            : __('Start 7-day Business trial', 'gr-widget'),
                        'url' => $grwi_business_trial_url,
                        'benefits' => [
                            __('Unlimited widgets', 'gr-widget'),
                            __('Unlimited reviews', 'gr-widget'),
                            __('Reviewer avatar photos', 'gr-widget'),
                            __('Every layout', 'gr-widget'),
                            __('Advanced customisation', 'gr-widget'),
                            __('Daily sync', 'gr-widget'),
                            __('AI review summary', 'gr-widget'),
                            __('Stars in Google search', 'gr-widget'),
                            __('Photos uploaded with reviews', 'gr-widget'),
                        ],
                    ],
                ];
                ?>
                <section class="grw-layout-upgrade grw-layout-upgrade--sidebar" data-grwi-plan="business" aria-labelledby="grwi-sidebar-upgrade-heading">
                    <header class="grw-layout-upgrade__intro">
                        <div class="grw-layout-upgrade__kicker">
                            <span class="grw-layout-upgrade__mark" aria-hidden="true">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none">
                                    <path d="M4.2 16.2 6.6 8.4 10.2 12.4 12 5.8l1.8 6.6 3.6-4 2.4 7.8H4.2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
                                    <path d="M5 19.2h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                                </svg>
                            </span>
                            <span class="grw-layout-upgrade__pill"><?php esc_html_e('TRY PREMIUM', 'gr-widget'); ?></span>
                        </div>
                        <h3 id="grwi-sidebar-upgrade-heading" class="grw-layout-upgrade__intro-title"><?php esc_html_e('Unlock everything GR Widget can do', 'gr-widget'); ?></h3>
                        <p class="grw-layout-upgrade__intro-copy">
                            <?php esc_html_e('Try our premium features free for 7 days.', 'gr-widget'); ?><br>
                            <?php esc_html_e('Choose the plan that fits your website', 'gr-widget'); ?>
                        </p>
                    </header>
                    <div class="grw-plan-switch" role="tablist" aria-label="<?php esc_attr_e('Compare Site and Business', 'gr-widget'); ?>">
                        <button type="button" class="grw-plan-switch__btn" role="tab" aria-selected="false" data-grwi-plan-switch="site"><?php esc_html_e('Site', 'gr-widget'); ?></button>
                        <button type="button" class="grw-plan-switch__btn is-active" role="tab" aria-selected="true" data-grwi-plan-switch="business"><?php esc_html_e('Business', 'gr-widget'); ?></button>
                    </div>
                    <?php foreach ($grwi_sidebar_plans as $grwi_plan_key => $grwi_plan) : ?>
                        <div class="grw-plan-panel" data-grwi-plan-panel="<?php echo esc_attr($grwi_plan_key); ?>"<?php echo $grwi_plan_key === 'business' ? '' : ' hidden'; ?>>
                            <header class="grw-layout-upgrade__head">
                                <h3 class="grw-layout-upgrade__title">
                                    <?php echo esc_html($grwi_plan['title']); ?>
                                </h3>
                                <p class="grw-layout-upgrade__lede"><?php echo esc_html($grwi_plan['lede']); ?></p>
                                <ul class="grw-layout-upgrade__benefits">
                                    <?php foreach ($grwi_plan['benefits'] as $grwi_benefit) : ?>
                                        <?php $grwi_render_sidebar_upgrade_benefit($grwi_benefit); ?>
                                    <?php endforeach; ?>
                                </ul>
                            </header>
                            <p class="grw-layout-upgrade__actions">
                                <a class="button button-primary grw-layout-upgrade__cta" href="<?php echo esc_url($grwi_plan['url']); ?>" target="_blank" rel="noopener noreferrer">
                                    <?php echo esc_html($grwi_plan['cta']); ?>
                                </a>
                            </p>
                        </div>
                    <?php endforeach; ?>
                    <p class="grw-layout-upgrade__compare">
                        <a href="<?php echo esc_url($grwi_compare_plans_url); ?>" target="_blank" rel="noopener noreferrer">
                            <?php esc_html_e('Compare all plans', 'gr-widget'); ?>
                        </a>
                    </p>
                </section>
            <?php endif; ?>

            <?php if ($grwi_widget_count > 0) : ?>
            <section class="grw-wp-review" aria-labelledby="grwi-wp-review-heading">
                <div class="grw-wp-review__head">
                    <span class="grw-wp-review__logo" aria-hidden="true"><span class="dashicons dashicons-wordpress"></span></span>
                    <div class="grw-wp-review__head-copy">
                        <h3 id="grwi-wp-review-heading" class="grw-wp-review__title"><?php esc_html_e('Share your GR Widget experience', 'gr-widget'); ?></h3>
                    </div>
                </div>
                <p class="grw-wp-review__text"><?php esc_html_e('Whether your experience has been positive or critical, your honest review helps other users and helps us improve GR Widget.', 'gr-widget'); ?></p>
                <a class="grw-wp-review__btn" href="https://wordpress.org/support/plugin/gr-widget/reviews/#new-post" target="_blank" rel="noopener noreferrer"><?php esc_html_e('Leave a WordPress review', 'gr-widget'); ?></a>
                <p class="grw-wp-review__feedback">
                    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true"><path d="M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v6.2a1.5 1.5 0 0 1-1.5 1.5H8.2L4.5 16.8V13.7H4A1.5 1.5 0 0 1 2.5 12.2V6A1.5 1.5 0 0 1 4 4.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
                    <?php esc_html_e('Have a suggestion?', 'gr-widget'); ?>
                    <a href="https://grwidget.com/community/c/wordpress-plugin" target="_blank" rel="noopener noreferrer"><?php esc_html_e('Send us feedback', 'gr-widget'); ?></a>
                </p>
            </section>
            <?php endif; ?>

            <?php if ($grwi_widget_count === 0) : ?>
                <section class="grw-setup-help" aria-labelledby="grwi-setup-help-heading">
                    <span class="grw-setup-help__icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none">
                            <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15.5a.5.5 0 0 1-.5.5H7.5A2.5 2.5 0 0 0 5 21.5V5.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                            <path d="M5 19.2A2.5 2.5 0 0 1 7.5 17H19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                        </svg>
                    </span>
                    <div class="grw-setup-help__copy">
                        <h3 id="grwi-setup-help-heading" class="grw-setup-help__title"><?php esc_html_e('Need help?', 'gr-widget'); ?></h3>
                        <a class="grw-setup-help__link" href="https://grwidget.com/blog/wordpress?source=wordpress-plugin" target="_blank" rel="noopener noreferrer">
                            <?php esc_html_e('View our installation guide', 'gr-widget'); ?>
                            <span aria-hidden="true">→</span>
                        </a>
                        <p class="grw-setup-help__text"><?php esc_html_e('Get step-by-step instructions to create your first widget.', 'gr-widget'); ?></p>
                    </div>
                </section>
            <?php endif; ?>
        </aside>
    </div>

    <div id="grwi-preview-first-toast" class="grw-preview-first-toast" hidden role="status" aria-live="polite">
        <div class="grw-preview-first-toast__inner">
            <div>
                <p id="grwi-preview-first-toast-title" class="grw-preview-first-toast__title"></p>
                <p id="grwi-preview-first-toast-body" class="grw-preview-first-toast__body"></p>
            </div>
            <button type="button" class="grw-preview-first-toast__close" data-grwi-toast-close aria-label="<?php esc_attr_e('Dismiss', 'gr-widget'); ?>">&times;</button>
        </div>
    </div>

    <div
        id="grwi-unlock-modal"
        class="grw-unlock-modal"
        hidden
        role="dialog"
        aria-modal="true"
        aria-labelledby="grwi-unlock-modal-title"
    >
        <div class="grw-unlock-modal__backdrop" data-grw-unlock-close tabindex="-1" aria-hidden="true"></div>
        <div class="grw-unlock-modal__panel" role="document">
            <button type="button" class="grw-unlock-modal__close" data-grw-unlock-close aria-label="<?php esc_attr_e('Close', 'gr-widget'); ?>">
                <span aria-hidden="true">&times;</span>
            </button>
            <h2 id="grwi-unlock-modal-title" class="grw-unlock-modal__title"></h2>
            <p class="grw-unlock-modal__body" id="grwi-unlock-modal-body"></p>
            <p class="grw-unlock-modal__supporting" id="grwi-unlock-modal-supporting" hidden></p>
            <div class="grw-unlock-modal__actions">
                <button type="button" class="button button-primary grw-unlock-modal__primary" id="grwi-unlock-modal-primary"></button>
                <button type="button" class="button button-secondary grw-unlock-modal__secondary" id="grwi-unlock-modal-secondary"></button>
            </div>
            <p class="grw-unlock-modal__footer" id="grwi-unlock-modal-footer" hidden></p>
            <p class="grw-unlock-modal__note" id="grwi-unlock-modal-note" hidden></p>
            <button type="button" class="button-link grw-unlock-modal__link-only" id="grwi-unlock-modal-link-only" hidden></button>
        </div>
    </div>

    <?php if (! empty($widgets)) : ?>
        <div
            id="grwi-widget-preview-modal"
            class="grw-widget-preview-modal"
            hidden
            role="dialog"
            aria-modal="true"
            aria-labelledby="grwi-widget-preview-modal-title"
        >
            <div class="grw-widget-preview-modal__backdrop" data-grw-preview-close tabindex="-1" aria-hidden="true"></div>
            <div class="grw-widget-preview-modal__panel" role="document">
                <header class="grw-widget-preview-modal__header">
                    <h2 id="grwi-widget-preview-modal-title" class="grw-widget-preview-modal__title"></h2>
                    <button type="button" class="grw-widget-preview-modal__close" data-grw-preview-close aria-label="<?php esc_attr_e('Close preview', 'gr-widget'); ?>">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </header>
                <div class="grw-widget-preview-modal__body">
                    <p class="grw-widget-preview-modal__saved-state" data-grwi-saved-preview-label hidden></p>
                    <div class="grw-widget-preview-modal__loading" aria-live="polite">
                        <span class="grw-spinner" aria-hidden="true"></span>
                        <span><?php esc_html_e('Loading preview…', 'gr-widget'); ?></span>
                    </div>
                    <div class="wb-preview-root grw-widget-preview-modal__preview-root">
                        <div id="grwi-widget-preview-mount" data-grwidget-locale="<?php echo esc_attr(GRWI_Embed::frontend_locale()); ?>" class="grw-widget-preview-modal__mount" data-wb-builder-preview hidden></div>
                    </div>
                </div>
            </div>
        </div>

        <div
            id="grwi-delete-widget-modal"
            class="grw-confirm-modal"
            hidden
            role="dialog"
            aria-modal="true"
            aria-labelledby="grwi-delete-widget-title"
        >
            <div class="grw-confirm-modal__backdrop" data-grw-delete-close tabindex="-1" aria-hidden="true"></div>
            <div class="grw-confirm-modal__panel" role="document">
                <h2 id="grwi-delete-widget-title" class="grw-confirm-modal__title"><?php esc_html_e('Delete widget', 'gr-widget'); ?></h2>
                <p id="grwi-delete-widget-body" class="grw-confirm-modal__body"></p>
                <div class="grw-confirm-modal__actions">
                    <button type="button" class="grw-confirm-modal__btn grw-confirm-modal__btn--cancel" data-grw-delete-close>
                        <?php esc_html_e('Cancel', 'gr-widget'); ?>
                    </button>
                    <button type="button" class="grw-confirm-modal__btn grw-confirm-modal__btn--danger" id="grwi-delete-widget-confirm">
                        <?php esc_html_e('Delete widget', 'gr-widget'); ?>
                    </button>
                </div>
            </div>
        </div>
    <?php endif; ?>

    <footer class="grw-footer">
        <p class="grw-footer__about"><?php esc_html_e('Widgets are rendered by GRWidget.com. This plugin does not store reviews locally.', 'gr-widget'); ?></p>
        <ul class="grw-footer__meta">
            <li><?php
                printf(
                    /* translators: %s: plugin version number. */
                    esc_html__('Plugin v%s', 'gr-widget'),
                    esc_html(GRWI_VERSION)
                );
            ?></li>
            <li><?php
                printf(
                    /* translators: %s: plan name (e.g. Free, Site, Business). */
                    esc_html__('Plan: %s', 'gr-widget'),
                    esc_html($grwi_footer_plan_name)
                );
            ?></li>
            <li><?php
                printf(
                    /* translators: %s: maximum widget count for the current plan, or "Unlimited". */
                    esc_html__('Max widgets: %s', 'gr-widget'),
                    esc_html($grwi_widgets_unlimited ? __('Unlimited', 'gr-widget') : (string) $grwi_max_widgets)
                );
            ?></li>
            <?php if ($grwi_google_label !== '') : ?>
            <li><?php
                printf(
                    /* translators: %s: Google businesses used and allowed, for example "1 / 1". */
                    esc_html__('Google businesses: %s', 'gr-widget'),
                    esc_html($grwi_google_label)
                );
            ?></li>
            <?php endif; ?>
            <li><?php
                printf(
                    /* translators: %s: review display limit for the current plan (e.g. "Up to 10 per widget" or "Unlimited"). */
                    esc_html__('Reviews shown: %s', 'gr-widget'),
                    esc_html($grwi_reviews_shown_label)
                );
            ?></li>
            <li><a href="<?php echo esc_url($upgrade_url); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e('View plans & start free trial', 'gr-widget'); ?></a></li>
            <li><a href="https://grwidget.com/community/c/wordpress-plugin" target="_blank" rel="noopener noreferrer"><?php esc_html_e('WordPress help', 'gr-widget'); ?></a></li>
        </ul>
    </footer>
</div>
