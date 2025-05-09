/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { Cookie, parse as parseCookie } from 'tough-cookie';
import { FtrProviderContext } from '../../ftr_provider_context';

export default function ({ getService }: FtrProviderContext) {
  const supertest = getService('supertestWithoutAuth');
  const config = getService('config');

  const kibanaServerConfig = config.get('servers.kibana');
  const validUsername = kibanaServerConfig.username;
  const validPassword = kibanaServerConfig.password;

  describe('Basic authentication', () => {
    it('should redirect non-AJAX requests to the login page if not authenticated', async () => {
      const response = await supertest.get('/abc/xyz').expect(302);

      expect(response.headers.location).to.be('/login?next=%2Fabc%2Fxyz');
    });

    it('should redirect non-AJAX New platform requests to the login page if not authenticated', async () => {
      const response = await supertest.get('/core/').expect(302);

      expect(response.headers.location).to.be('/login?next=%2Fcore%2F');
    });

    it('should reject API requests if client is not authenticated', async () => {
      await supertest.get('/internal/security/me').set('kbn-xsrf', 'xxx').expect(401);
    });

    it('should reject login with wrong credentials', async () => {
      const wrongUsername = `wrong-${validUsername}`;
      const wrongPassword = `wrong-${validPassword}`;

      await supertest
        .post('/internal/security/login')
        .set('kbn-xsrf', 'xxx')
        .send({
          providerType: 'basic',
          providerName: 'basic',
          currentURL: '/',
          params: { username: wrongUsername, password: wrongPassword },
        })
        .expect(401);

      await supertest
        .post('/internal/security/login')
        .set('kbn-xsrf', 'xxx')
        .send({
          providerType: 'basic',
          providerName: 'basic',
          currentURL: '/',
          params: { username: validUsername, password: wrongPassword },
        })
        .expect(401);

      await supertest
        .post('/internal/security/login')
        .set('kbn-xsrf', 'xxx')
        .send({
          providerType: 'basic',
          providerName: 'basic',
          currentURL: '/',
          params: { username: wrongUsername, password: validPassword },
        })
        .expect(401);
    });

    it('should set authentication cookie for login with valid credentials', async () => {
      const loginResponse = await supertest
        .post('/internal/security/login')
        .set('kbn-xsrf', 'xxx')
        .send({
          providerType: 'basic',
          providerName: 'basic',
          currentURL: '/',
          params: { username: validUsername, password: validPassword },
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];
      expect(cookies).to.have.length(1);

      const sessionCookie = parseCookie(cookies[0]);
      expect(sessionCookie).to.not.be(undefined);
      expect(sessionCookie!.key).to.be('sid');
      expect(sessionCookie!.value).to.not.be.empty();
      expect(sessionCookie!.path).to.be('/');
      expect(sessionCookie!.httpOnly).to.be(true);
    });

    it('should reject access to the API with wrong credentials in the header', async () => {
      const wrongUsername = `wrong-${validUsername}`;
      const wrongPassword = `wrong-${validPassword}`;

      await supertest
        .get('/internal/security/me')
        .set('kbn-xsrf', 'xxx')
        .set(
          'Authorization',
          `Basic ${Buffer.from(`${wrongUsername}:${wrongPassword}`).toString('base64')}`
        )
        .expect(401);

      await supertest
        .get('/internal/security/me')
        .set('kbn-xsrf', 'xxx')
        .set(
          'Authorization',
          `Basic ${Buffer.from(`${validUsername}:${wrongPassword}`).toString('base64')}`
        )
        .expect(401);

      await supertest
        .get('/internal/security/me')
        .set('kbn-xsrf', 'xxx')
        .set(
          'Authorization',
          `Basic ${Buffer.from(`${wrongUsername}:${validPassword}`).toString('base64')}`
        )
        .expect(401);
    });

    it('should allow access to the API with valid credentials in the header', async () => {
      const apiResponse = await supertest
        .get('/internal/security/me')
        .set('kbn-xsrf', 'xxx')
        .set(
          'Authorization',
          `Basic ${Buffer.from(`${validUsername}:${validPassword}`).toString('base64')}`
        )
        .expect(200);

      expect(apiResponse.body).to.have.keys([
        'username',
        'full_name',
        'email',
        'roles',
        'metadata',
        'enabled',
        'authentication_realm',
        'lookup_realm',
        'authentication_provider',
        'authentication_type',
        'elastic_cloud_user',
      ]);
      expect(apiResponse.body.username).to.be(validUsername);
      expect(apiResponse.body.authentication_provider).to.eql({ type: 'http', name: '__http__' });
      expect(apiResponse.body.authentication_type).to.be('realm');
      // Do not assert on the `authentication_realm`, as the value differs for on-prem vs cloud
    });

    describe('with session cookie', () => {
      let sessionCookie: Cookie | undefined;
      beforeEach(async () => {
        const loginResponse = await supertest
          .post('/internal/security/login')
          .set('kbn-xsrf', 'xxx')
          .send({
            providerType: 'basic',
            providerName: 'basic',
            currentURL: '/',
            params: { username: validUsername, password: validPassword },
          })
          .expect(200);

        sessionCookie = parseCookie(loginResponse.headers['set-cookie'][0]);
        expect(sessionCookie).to.not.be(undefined);
      });

      it('should allow access to the API', async () => {
        // There is no session cookie provided and no server side session should have
        // been established, so request should be rejected.
        await supertest.get('/internal/security/me').set('kbn-xsrf', 'xxx').expect(401);

        const apiResponse = await supertest
          .get('/internal/security/me')
          .set('kbn-xsrf', 'xxx')
          .set('Cookie', sessionCookie!.cookieString())
          .expect(200);

        expect(apiResponse.body).to.have.keys([
          'username',
          'full_name',
          'email',
          'roles',
          'metadata',
          'enabled',
          'authentication_realm',
          'lookup_realm',
          'authentication_provider',
          'authentication_type',
          'elastic_cloud_user',
        ]);
        expect(apiResponse.body.username).to.be(validUsername);
        expect(apiResponse.body.authentication_provider).to.eql({ type: 'basic', name: 'basic' });
        expect(apiResponse.body.authentication_type).to.be('realm');
        // Do not assert on the `authentication_realm`, as the value differs for on-prem vs cloud
      });

      it('should extend cookie on every successful non-system API call', async () => {
        const apiResponseOne = await supertest
          .get('/internal/security/me')
          .set('kbn-xsrf', 'xxx')
          .set('Cookie', sessionCookie!.cookieString())
          .expect(200);

        expect(apiResponseOne.headers['set-cookie']).to.not.be(undefined);
        const sessionCookieOne = parseCookie(apiResponseOne.headers['set-cookie'][0]);

        expect(sessionCookieOne).to.not.be(undefined);
        expect(sessionCookieOne!.value).to.not.be.empty();
        expect(sessionCookieOne!.value).to.not.equal(sessionCookie!.value);

        const apiResponseTwo = await supertest
          .get('/internal/security/me')
          .set('kbn-xsrf', 'xxx')
          .set('Cookie', sessionCookie!.cookieString())
          .expect(200);

        expect(apiResponseTwo.headers['set-cookie']).to.not.be(undefined);
        const sessionCookieTwo = parseCookie(apiResponseTwo.headers['set-cookie'][0]);

        expect(sessionCookieTwo).to.not.be(undefined);
        expect(sessionCookieTwo!.value).to.not.be.empty();
        expect(sessionCookieTwo!.value).to.not.equal(sessionCookieOne!.value);
      });

      it('should not extend cookie for system API calls', async () => {
        const systemAPIResponse = await supertest
          .get('/internal/security/me')
          .set('kbn-xsrf', 'xxx')
          .set('kbn-system-request', 'true')
          .set('Cookie', sessionCookie!.cookieString())
          .expect(200);

        expect(systemAPIResponse.headers['set-cookie']).to.be(undefined);
      });

      it('should fail and preserve session cookie if unsupported authentication schema is used', async () => {
        const apiResponse = await supertest
          .get('/internal/security/me')
          .set('kbn-xsrf', 'xxx')
          .set('Authorization', 'Bearer AbCdEf')
          .set('Cookie', sessionCookie!.cookieString())
          .expect(401);

        expect(apiResponse.headers['set-cookie']).to.be(undefined);
      });

      it('should clear cookie on logout and redirect to login', async () => {
        const logoutResponse = await supertest
          .get('/api/security/logout?next=%2Fabc%2Fxyz&msg=test')
          .set('Cookie', sessionCookie!.cookieString())
          .expect(302);

        const cookies = logoutResponse.headers['set-cookie'];
        expect(cookies).to.have.length(1);

        const logoutCookie = parseCookie(cookies[0]);
        expect(logoutCookie).to.not.be(undefined);
        expect(logoutCookie!.key).to.be('sid');
        expect(logoutCookie!.value).to.be.empty();
        expect(logoutCookie!.path).to.be('/');
        expect(logoutCookie!.httpOnly).to.be(true);
        expect(logoutCookie!.maxAge).to.be(0);

        expect(logoutResponse.headers.location).to.be('/login?next=%2Fabc%2Fxyz&msg=test');
      });

      it('should not render login page and redirect to `next` URL', async () => {
        const loginViewResponse = await supertest
          .get('/login?next=%2Fapp%2Fml%3Fone%3Dtwo')
          .set('Cookie', sessionCookie!.cookieString())
          .expect(302);

        expect(loginViewResponse.headers.location).to.be('/app/ml?one=two');
      });

      it('should not render login page and redirect to the base path if `next` is absolute URL', async () => {
        const loginViewResponse = await supertest
          .get('/login?next=http%3A%2F%2Fhack.you%2F%3Fone%3Dtwo')
          .set('Cookie', sessionCookie!.cookieString())
          .expect(302);

        expect(loginViewResponse.headers.location).to.be('/');
      });

      it('should not render login page and redirect to the base path if `next` is network-path reference', async () => {
        // Try `//hack.you` that NodeJS URL parser with `slashesDenoteHost` option
        let loginViewResponse = await supertest
          .get('/login?next=%2F%2Fhack.you%2F%3Fone%3Dtwo')
          .set('Cookie', sessionCookie!.cookieString())
          .expect(302);

        expect(loginViewResponse.headers.location).to.be('/');

        // Try link with 3 slashes, that is still valid redirect target for browsers (for bwc reasons),
        // but is parsed in a different by NodeJS URL parser.
        loginViewResponse = await supertest
          .get('/login?next=%2F%2F%2Fhack.you%2F%3Fone%3Dtwo')
          .set('Cookie', sessionCookie!.cookieString())
          .expect(302);

        expect(loginViewResponse.headers.location).to.be('/');
      });

      it('should redirect to login page if cookie is not provided', async () => {
        const logoutResponse = await supertest.get('/api/security/logout').expect(302);

        expect(logoutResponse.headers['set-cookie']).to.be(undefined);
        expect(logoutResponse.headers.location).to.be('/login?msg=LOGGED_OUT');
      });
    });
  });
}
