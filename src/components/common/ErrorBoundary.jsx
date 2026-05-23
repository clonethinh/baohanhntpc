import { Component } from 'react';
import { Button, Result } from 'antd';
import i18n from '../../i18n/index.js';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title={i18n.t('errorBoundary.title')}
          subTitle={i18n.t('errorBoundary.description')}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              {i18n.t('button.taiLai')}
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
