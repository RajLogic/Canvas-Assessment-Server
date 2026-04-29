export function getDashboardRoute(version) {
    return version === 'v1' ? '/dashboardV1' : '/dashboard';
}