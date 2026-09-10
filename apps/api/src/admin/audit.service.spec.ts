import { parseAdminPath } from './audit.service';

describe('parseAdminPath', () => {
  it('maps mutating admin URLs to a resource action without reading bodies', () => {
    expect(parseAdminPath('POST', '/api/v1/admin/home/rows')).toEqual({
      action: 'post.home.rows',
      resource: 'home',
      resourceId: null,
    });
    expect(parseAdminPath('PATCH', '/api/v1/admin/users/64b0f2c8a1b2c3d4e5f60789/role')).toEqual({
      action: 'patch.users.role',
      resource: 'users',
      resourceId: '64b0f2c8a1b2c3d4e5f60789',
    });
    expect(parseAdminPath('DELETE', '/admin/plans/64b0f2c8a1b2c3d4e5f60789')).toEqual({
      action: 'delete.plans',
      resource: 'plans',
      resourceId: '64b0f2c8a1b2c3d4e5f60789',
    });
  });
});
