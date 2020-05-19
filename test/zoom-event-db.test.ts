import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as ZoomEventDb from '../lib/zoom-event-db-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new ZoomEventDb.ZoomEventDbStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
