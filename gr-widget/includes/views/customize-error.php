<?php

defined('ABSPATH') || exit;

/** Customize screen error state. */
$error_reconnect = ! empty($error_reconnect);
?>
<div class="wrap grw-admin">
    <div class="grw-empty grw-empty--error" role="alert">
        <h3 class="grw-empty__title">
            <?php echo $error_reconnect
                ? esc_html__('Reconnect your GR Widget account', 'gr-widget')
                : esc_html__('Could not open this widget', 'gr-widget'); ?>
        </h3>
        <p class="grw-empty__text"><?php echo esc_html($error_message ?? __('Widget not found.', 'gr-widget')); ?></p>
        <p class="grw-empty__actions">
            <?php if ($error_reconnect) : ?>
                <button type="button" class="button button-primary" data-grwi-connect-account>
                    <?php esc_html_e('Reconnect account', 'gr-widget'); ?>
                </button>
            <?php endif; ?>
            <a class="button" href="<?php echo esc_url(GRWI_Admin::admin_page_url()); ?>"><?php esc_html_e('Back to widgets', 'gr-widget'); ?></a>
        </p>
    </div>
</div>
